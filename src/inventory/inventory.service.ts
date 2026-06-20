import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { StockLedgerService } from './stock-ledger.service';
import { StockEventsGateway } from 'src/realtime/stock-events.gateway';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { UpdateThresholdDto } from './dto/update-threshold.dto';

const PRODUCT_SIZE_INCLUDE = {
  size: true,
  color: {
    include: {
      color: true,
      product: { select: { id: true, title: true, slug: true, sku: true } },
    },
  },
} satisfies Prisma.ProductSizeInclude;

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
    private stockLedgerService: StockLedgerService,
    private stockEventsGateway: StockEventsGateway,
  ) {}

  private toInventoryRow(
    item: Prisma.ProductSizeGetPayload<{
      include: typeof PRODUCT_SIZE_INCLUDE;
    }>,
  ) {
    return {
      productSizeId: item.id,
      sku: item.sku,
      quantity: item.quantity,
      lowStockAt: item.lowStockAt,
      isLowStock: item.quantity <= item.lowStockAt,
      size: item.size.name,
      color: item.color.color.name,
      product: item.color.product,
    };
  }

  async getInventory(query: {
    search?: string;
    onlyLowStock?: boolean;
    skip?: number;
    take?: number;
  }) {
    const { search, onlyLowStock, skip, take } = query;

    const where: Prisma.ProductSizeWhereInput = {
      ...(onlyLowStock && {
        quantity: { lte: this.prisma.productSize.fields.lowStockAt },
      }),
      ...(search && {
        color: {
          product: { title: { contains: search, mode: 'insensitive' } },
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.productSize.findMany({
        where,
        include: PRODUCT_SIZE_INCLUDE,
        orderBy: { id: 'asc' },
        skip,
        take,
      }),
      this.prisma.productSize.count({ where }),
    ]);

    return {
      total,
      items: items.map((item) => this.toInventoryRow(item)),
    };
  }

  async getLowStockSummary() {
    const items = await this.prisma.productSize.findMany({
      where: { quantity: { lte: this.prisma.productSize.fields.lowStockAt } },
      include: PRODUCT_SIZE_INCLUDE,
      orderBy: { quantity: 'asc' },
    });

    return {
      count: items.length,
      items: items.map((item) => this.toInventoryRow(item)),
    };
  }

  async getStockHistory(productSizeId: number) {
    const exists = await this.prisma.productSize.findUnique({
      where: { id: productSizeId },
    });
    if (!exists) {
      throw new NotFoundException(`Product size #${productSizeId} not found`);
    }

    return this.prisma.stockAdjustment.findMany({
      where: { productSizeId },
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { id: true, name: true } } },
    });
  }

  async adjustStock(
    productSizeId: number,
    dto: AdjustStockDto,
    adminId: number,
  ) {
    const productSize = await this.prisma.productSize.findUnique({
      where: { id: productSizeId },
      include: PRODUCT_SIZE_INCLUDE,
    });
    if (!productSize) {
      throw new NotFoundException(`Product size #${productSizeId} not found`);
    }

    const result = await this.prisma.$transaction((tx) =>
      this.stockLedgerService.recordAdjustment(tx, {
        productSizeId,
        productId: productSize.color.productId,
        delta: dto.delta,
        reason: dto.reason,
        note: dto.note,
        adminId,
        productLabel: productSize.color.product.title,
      }),
    );

    this.stockEventsGateway.emitStockUpdated({
      productSizeId,
      productId: productSize.color.productId,
      quantity: result.quantityAfter,
      lowStockAt: result.lowStockAt,
    });

    await this.activityLogService.log({
      adminId,
      action: 'ADJUST_STOCK',
      module: 'INVENTORY',
      targetId: productSizeId,
      targetLabel: productSize.color.product.title,
      oldValue: { quantity: productSize.quantity },
      newValue: { quantity: result.quantityAfter, reason: dto.reason },
    });

    return {
      productSizeId,
      quantity: result.quantityAfter,
      lowStockAt: result.lowStockAt,
    };
  }

  async updateThreshold(
    productSizeId: number,
    dto: UpdateThresholdDto,
    adminId: number,
  ) {
    const productSize = await this.prisma.productSize.findUnique({
      where: { id: productSizeId },
      include: PRODUCT_SIZE_INCLUDE,
    });
    if (!productSize) {
      throw new NotFoundException(`Product size #${productSizeId} not found`);
    }

    await this.prisma.productSize.update({
      where: { id: productSizeId },
      data: { lowStockAt: dto.lowStockAt },
    });

    this.stockEventsGateway.emitStockUpdated({
      productSizeId,
      productId: productSize.color.productId,
      quantity: productSize.quantity,
      lowStockAt: dto.lowStockAt,
    });

    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_LOW_STOCK_THRESHOLD',
      module: 'INVENTORY',
      targetId: productSizeId,
      targetLabel: productSize.color.product.title,
      oldValue: { lowStockAt: productSize.lowStockAt },
      newValue: { lowStockAt: dto.lowStockAt },
    });

    return {
      productSizeId,
      quantity: productSize.quantity,
      lowStockAt: dto.lowStockAt,
    };
  }

  async exportInventory() {
    const { items } = await this.getInventory({});

    return items.map((item) => ({
      productSizeId: item.productSizeId,
      productTitle: item.product.title,
      sku: item.sku ?? item.product.sku ?? '',
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      lowStockAt: item.lowStockAt,
      isLowStock: item.isLowStock,
    }));
  }
}
