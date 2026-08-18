/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
import { PartnerInventoryService } from './partner-inventory.service';
import { PrismaService } from 'src/prisma/prisma.service';

const makeRow = (id: number, overrides: Partial<any> = {}) => ({
  id,
  sku: `SKU-${id}`,
  quantity: 10,
  lowStockAt: 5,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  size: { name: 'Large' },
  color: {
    color: { name: 'Blue' },
    product: { title: 'Test Product', slug: 'test-product' },
  },
  ...overrides,
});

describe('PartnerInventoryService', () => {
  let service: PartnerInventoryService;
  let prisma: {
    productSize: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      fields: { lowStockAt: symbol };
    };
  };

  beforeEach(() => {
    prisma = {
      productSize: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        fields: { lowStockAt: Symbol('lowStockAt') },
      },
    };
    service = new PartnerInventoryService(prisma as unknown as PrismaService);
  });

  describe('list — cursor pagination', () => {
    it('reports no next page when results fit within the limit', async () => {
      prisma.productSize.findMany.mockResolvedValue([makeRow(1), makeRow(2)]);

      const result = await service.list({ limit: 5 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ nextCursor: null, count: 2 });
      expect(prisma.productSize.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 6 }), // limit + 1, no cursor arg passed
      );
    });

    it('sets nextCursor and trims the lookahead row when there are more results', async () => {
      prisma.productSize.findMany.mockResolvedValue([
        makeRow(1),
        makeRow(2),
        makeRow(3), // the "limit + 1"-th row proving there's another page
      ]);

      const result = await service.list({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.data.map((r) => r.id)).toEqual([1, 2]);
      expect(result.meta).toEqual({ nextCursor: '2', count: 2 });
    });

    it('returns an empty page past the end, not an error', async () => {
      prisma.productSize.findMany.mockResolvedValue([]);
      const result = await service.list({ cursor: 999, limit: 50 });
      expect(result).toEqual({
        data: [],
        meta: { nextCursor: null, count: 0 },
      });
    });

    it('passes cursor + skip:1 only when a cursor is given', async () => {
      prisma.productSize.findMany.mockResolvedValue([]);
      await service.list({ cursor: 42, limit: 10 });
      expect(prisma.productSize.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 42 }, skip: 1 }),
      );
    });

    it('caps limit at 200 even if a larger value slips through', async () => {
      prisma.productSize.findMany.mockResolvedValue([]);
      await service.list({ limit: 5000 as any });
      expect(prisma.productSize.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 201 }),
      );
    });

    it('defaults to a limit of 50 when none is given', async () => {
      prisma.productSize.findMany.mockResolvedValue([]);
      await service.list({});
      expect(prisma.productSize.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
    });

    it('filters by updatedSince and sku', async () => {
      prisma.productSize.findMany.mockResolvedValue([]);
      await service.list({
        updatedSince: '2026-01-01T00:00:00.000Z',
        sku: 'ABC',
      });
      const call = prisma.productSize.findMany.mock.calls[0][0];
      expect(call.where.sku).toBe('ABC');
      expect(call.where.updatedAt.gte).toEqual(
        new Date('2026-01-01T00:00:00.000Z'),
      );
    });
  });

  describe('listLowStock', () => {
    it('filters on quantity <= lowStockAt via the same pagination path', async () => {
      prisma.productSize.findMany.mockResolvedValue([]);
      await service.listLowStock({ limit: 10 });
      const call = prisma.productSize.findMany.mock.calls[0][0];
      expect(call.where.quantity).toEqual({
        lte: prisma.productSize.fields.lowStockAt,
      });
    });
  });

  describe('getById', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.productSize.findUnique.mockResolvedValue(null);
      await expect(service.getById(999)).rejects.toThrow(NotFoundException);
    });

    it('returns the mapped row wrapped in { data }', async () => {
      prisma.productSize.findUnique.mockResolvedValue(
        makeRow(1, { quantity: 3, lowStockAt: 5 }),
      );
      const result = await service.getById(1);
      expect(result.data).toMatchObject({
        id: 1,
        quantity: 3,
        isLowStock: true,
      });
    });
  });
});
