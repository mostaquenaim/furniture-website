import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListPartnerInventoryQueryDto } from './dto/list-partner-inventory-query.dto';

const DEFAULT_LIMIT = 50;

// A dedicated include, separate from InventoryService's — the partner
// contract must never silently change just because an admin-only field
// gets added to the internal query shape.
const PARTNER_PRODUCT_SIZE_INCLUDE = {
  size: true,
  color: {
    include: {
      color: true,
      product: { select: { title: true, slug: true } },
    },
  },
} satisfies Prisma.ProductSizeInclude;

type PartnerProductSizeRow = Prisma.ProductSizeGetPayload<{
  include: typeof PARTNER_PRODUCT_SIZE_INCLUDE;
}>;

@Injectable()
export class PartnerInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toPartnerRow(item: PartnerProductSizeRow) {
    return {
      id: item.id,
      sku: item.sku,
      productTitle: item.color.product.title,
      productSlug: item.color.product.slug,
      size: item.size.name,
      color: item.color.color.name,
      quantity: item.quantity,
      lowStockAt: item.lowStockAt,
      isLowStock: item.quantity <= item.lowStockAt,
      updatedAt: item.updatedAt,
    };
  }

  private buildWhere(
    query: Pick<ListPartnerInventoryQueryDto, 'updatedSince' | 'sku'>,
    extra?: Prisma.ProductSizeWhereInput,
  ): Prisma.ProductSizeWhereInput {
    return {
      ...(extra ?? {}),
      ...(query.updatedSince && {
        updatedAt: { gte: new Date(query.updatedSince) },
      }),
      ...(query.sku && { sku: query.sku }),
    };
  }

  private async paginate(
    where: Prisma.ProductSizeWhereInput,
    query: Pick<ListPartnerInventoryQueryDto, 'cursor' | 'limit'>,
  ) {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, 200);

    const items = await this.prisma.productSize.findMany({
      where,
      include: PARTNER_PRODUCT_SIZE_INCLUDE,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return {
      data: page.map((item) => this.toPartnerRow(item)),
      meta: {
        nextCursor: hasMore ? String(page[page.length - 1].id) : null,
        count: page.length,
      },
    };
  }

  list(query: ListPartnerInventoryQueryDto) {
    return this.paginate(this.buildWhere(query), query);
  }

  listLowStock(query: ListPartnerInventoryQueryDto) {
    const where = this.buildWhere(query, {
      quantity: { lte: this.prisma.productSize.fields.lowStockAt },
    });
    return this.paginate(where, query);
  }

  async getById(id: number) {
    const item = await this.prisma.productSize.findUnique({
      where: { id },
      include: PARTNER_PRODUCT_SIZE_INCLUDE,
    });
    if (!item) {
      throw new NotFoundException(`Product size #${id} not found`);
    }
    return { data: this.toPartnerRow(item) };
  }
}
