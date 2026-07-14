/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateFlashSaleDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleDto } from './dto/update-flash-sale.dto';
import { sanitizeDiscount } from '../common/utils/discount.utils';

const activeProductInclude = {
  images: true,
  colors: { include: { color: true } },
};

@Injectable()
export class FlashSalesService {
  private readonly logger = new Logger(FlashSalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /**
   * Public: the single campaign whose date window includes right now.
   * Products are individually sanitized — a product's own discount window
   * (discountStart/discountEnd) is independent of the campaign window.
   */
  async findActive() {
    const now = new Date();
    const flashSale = await this.prisma.flashSale.findFirst({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: 'desc' },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: { product: { include: activeProductInclude } },
        },
      },
    });

    if (!flashSale) return null;

    const { products, ...rest } = flashSale;
    return {
      ...rest,
      products: products
        .filter((fp) => fp.product.isActive)
        .map((fp) => sanitizeDiscount(fp.product)),
    };
  }

  /** Admin: all campaigns regardless of date or active state */
  findAll() {
    return this.prisma.flashSale.findMany({
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { products: true } } },
    });
  }

  /** Admin: single campaign with its curated product list, for the edit form */
  async findOne(id: number) {
    const flashSale = await this.prisma.flashSale.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                price: true,
                basePrice: true,
                images: { where: { serialNo: 1 }, take: 1 },
              },
            },
          },
        },
      },
    });
    if (!flashSale) throw new NotFoundException(`Flash sale ${id} not found`);
    return flashSale;
  }

  async create(dto: CreateFlashSaleDto, adminId: number) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }

    try {
      const flashSale = await this.prisma.flashSale.create({
        data: {
          title: dto.title,
          subtitle: dto.subtitle ?? null,
          bannerText: dto.bannerText ?? null,
          startDate: start,
          endDate: end,
          isActive: dto.isActive ?? true,
          products: {
            create: (dto.productIds ?? []).map((productId, i) => ({
              productId,
              sortOrder: i,
            })),
          },
        },
        include: { _count: { select: { products: true } } },
      });

      this.activityLog.log({
        adminId,
        action: 'CREATE_FLASH_SALE',
        module: 'MARKETING',
        targetId: flashSale.id,
        targetLabel: flashSale.title,
        newValue: flashSale,
      });

      return flashSale;
    } catch (error) {
      this.logger.error(`Failed to create flash sale: ${error.message}`);
      throw new InternalServerErrorException('Could not create flash sale');
    }
  }

  async update(id: number, dto: UpdateFlashSaleDto, adminId: number) {
    const existing = await this.prisma.flashSale.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Flash sale ${id} not found`);

    const start = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : existing.endDate;

    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate');
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.productIds) {
          await tx.flashSaleProduct.deleteMany({ where: { flashSaleId: id } });
          if (dto.productIds.length) {
            await tx.flashSaleProduct.createMany({
              data: dto.productIds.map((productId, i) => ({
                flashSaleId: id,
                productId,
                sortOrder: i,
              })),
            });
          }
        }

        return tx.flashSale.update({
          where: { id },
          data: {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
            ...(dto.bannerText !== undefined && { bannerText: dto.bannerText }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            startDate: start,
            endDate: end,
          },
          include: { _count: { select: { products: true } } },
        });
      });

      this.activityLog.log({
        adminId,
        action: 'UPDATE_FLASH_SALE',
        module: 'MARKETING',
        targetId: id,
        targetLabel: updated.title,
        oldValue: existing,
        newValue: updated,
      });

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update flash sale ${id}: ${error.message}`);
      throw new InternalServerErrorException('Could not update flash sale');
    }
  }

  async remove(id: number, adminId: number) {
    const existing = await this.prisma.flashSale.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Flash sale ${id} not found`);

    await this.prisma.flashSale.delete({ where: { id } });

    this.activityLog.log({
      adminId,
      action: 'DELETE_FLASH_SALE',
      module: 'MARKETING',
      targetId: id,
      targetLabel: existing.title,
      oldValue: existing,
    });
  }
}
