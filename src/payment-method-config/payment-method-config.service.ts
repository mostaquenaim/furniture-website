import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Prisma, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodConfigDto } from './dto/create-payment-method-config.dto';
import { UpdatePaymentMethodConfigDto } from './dto/update-payment-method-config.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

// `config` can hold gateway API keys/secrets — never write it into the
// activity log's oldValue/newValue, even though those routes are admin-only.
function redactConfig(row: Record<string, any>) {
  const { config, ...rest } = row;
  return rest;
}

// Fields safe to expose on the public "active methods" endpoint — `config`
// can hold gateway API keys/secrets and must never leave the admin-guarded
// routes.
const PUBLIC_SELECT = {
  id: true,
  method: true,
  gateway: true,
  displayName: true,
  displayOrder: true,
  minAmount: true,
  maxAmount: true,
  convenienceFeeType: true,
  convenienceFeeValue: true,
  availableForCODOnly: true,
} satisfies Prisma.PaymentMethodConfigSelect;

@Injectable()
export class PaymentMethodConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentMethodConfigService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  // Ensures the two payment methods this app can actually initiate (COD and
  // the SSLCommerz online gateway) always have a config row, so admins have
  // something to toggle from day one instead of an empty table.
  async onApplicationBootstrap() {
    const defaults: CreatePaymentMethodConfigDto[] = [
      {
        method: PaymentMethod.COD,
        gateway: 'COD',
        displayName: 'Cash on Delivery',
        displayOrder: 0,
      },
      {
        method: PaymentMethod.SSL,
        gateway: 'SSLCOMMERZ',
        displayName: 'Online Payment (SSLCommerz)',
        displayOrder: 1,
      },
    ];

    for (const def of defaults) {
      const existing = await this.prisma.paymentMethodConfig.findUnique({
        where: { method_gateway: { method: def.method, gateway: def.gateway } },
      });

      if (!existing) {
        await this.prisma.paymentMethodConfig.create({ data: def });
        this.logger.log(
          `Seeded default payment method config: ${def.method}/${def.gateway}`,
        );
      }
    }
  }

  // Admin-facing: every row, including disabled ones, full detail (config included).
  findAllAdmin() {
    return this.prisma.paymentMethodConfig.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  // Public-facing: only enabled rows, secrets stripped — used by checkout UI.
  findActive() {
    return this.prisma.paymentMethodConfig.findMany({
      where: { isEnabled: true },
      orderBy: { displayOrder: 'asc' },
      select: PUBLIC_SELECT,
    });
  }

  async findOne(id: number) {
    const config = await this.prisma.paymentMethodConfig.findUnique({
      where: { id },
    });
    if (!config) {
      throw new NotFoundException('Payment method config not found');
    }
    return config;
  }

  async create(dto: CreatePaymentMethodConfigDto, adminId: number) {
    const existing = await this.prisma.paymentMethodConfig.findUnique({
      where: { method_gateway: { method: dto.method, gateway: dto.gateway } },
    });
    if (existing) {
      throw new ConflictException(
        `A config for ${dto.method}/${dto.gateway} already exists`,
      );
    }

    const created = await this.prisma.paymentMethodConfig.create({
      data: dto,
    });

    await this.activityLogService.log({
      adminId,
      action: 'CREATE_PAYMENT_METHOD',
      module: 'SYSTEM',
      targetId: created.id,
      targetLabel: created.displayName,
      newValue: redactConfig(created),
    });

    return created;
  }

  async update(id: number, dto: UpdatePaymentMethodConfigDto, adminId: number) {
    const before = await this.findOne(id);
    const updated = await this.prisma.paymentMethodConfig.update({
      where: { id },
      data: dto,
    });

    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_PAYMENT_METHOD',
      module: 'SYSTEM',
      targetId: id,
      targetLabel: updated.displayName,
      oldValue: redactConfig(before),
      newValue: redactConfig(updated),
    });

    return updated;
  }

  async remove(id: number, adminId: number) {
    const existing = await this.findOne(id);
    await this.prisma.paymentMethodConfig.delete({ where: { id } });

    await this.activityLogService.log({
      adminId,
      action: 'DELETE_PAYMENT_METHOD',
      module: 'SYSTEM',
      targetId: id,
      targetLabel: existing.displayName,
      severity: 'WARNING',
      oldValue: redactConfig(existing),
    });

    return { success: true };
  }

  // Called from the real checkout/payment-initiation code paths (COD order
  // creation, SSLCommerz initiation) — throws if the method is disabled or
  // the order amount falls outside the admin-configured min/max range.
  async assertEnabled(method: PaymentMethod, amount: number): Promise<void> {
    const config = await this.prisma.paymentMethodConfig.findFirst({
      where: { method },
      orderBy: { displayOrder: 'asc' },
    });

    // No config row at all → fail open (don't block checkout over a config
    // row that was never seeded/was deleted by mistake).
    if (!config) return;

    if (!config.isEnabled) {
      throw new BadRequestException(
        `${config.displayName} is currently unavailable. Please choose another payment method.`,
      );
    }

    if (config.minAmount != null && amount < config.minAmount) {
      throw new BadRequestException(
        `${config.displayName} requires a minimum order amount of ${config.minAmount}`,
      );
    }

    if (config.maxAmount != null && amount > config.maxAmount) {
      throw new BadRequestException(
        `${config.displayName} only supports orders up to ${config.maxAmount}`,
      );
    }
  }
}
