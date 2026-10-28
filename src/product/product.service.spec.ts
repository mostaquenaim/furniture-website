/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PieceService } from '../piece/piece.service';
import { PublicReadCacheService } from '../common/cache/public-read-cache.service';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      searchLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        PublicReadCacheService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { log: jest.fn() } },
        {
          provide: PieceService,
          useValue: { generatePiecesForNewSize: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllProducts caching', () => {
    it('serves a repeated storefront listing from cache', async () => {
      await service.getAllProducts({ page: 1, limit: 18 });
      await service.getAllProducts({ page: 1, limit: 18 });

      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    });

    it('does not share cache entries between different queries', async () => {
      await service.getAllProducts({ page: 1, limit: 18 });
      await service.getAllProducts({ page: 2, limit: 18 });
      await service.getAllProducts({ page: 1, limit: 18, search: 'sofa' });

      expect(prisma.product.findMany).toHaveBeenCalledTimes(3);
    });

    it('only ever lists active, in-stock products', async () => {
      // even if a caller slips the staff flags in at runtime
      await service.getAllProducts({
        page: 1,
        isActive: false,
        includeOutOfStock: true,
      } as any);

      const { where } = prisma.product.findMany.mock.calls[0][0];
      expect(where.isActive).toBe(true);
      expect(where.totalProductQuantity).toEqual({ gt: 0 });
    });

    it('staff listing honours its filters, is never cached, and is not logged', async () => {
      await service.getAdminProducts({
        isActive: false,
        includeOutOfStock: true,
        search: 'sofa',
      });
      await service.getAdminProducts({
        isActive: false,
        includeOutOfStock: true,
        search: 'sofa',
      });

      expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
      const { where } = prisma.product.findMany.mock.calls[0][0];
      expect(where.isActive).toBe(false);
      expect(where.totalProductQuantity).toBeUndefined();
      expect(prisma.searchLog.create).not.toHaveBeenCalled();
    });

    it('logs every search, including cache hits', async () => {
      await service.getAllProducts({ search: 'sofa', limit: 9 });
      await service.getAllProducts({ search: 'sofa', limit: 9 });

      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.searchLog.create).toHaveBeenCalledTimes(2);
    });

    it('a product edit clears the cache', async () => {
      prisma.product.findUnique.mockResolvedValue({ isActive: true });
      prisma.product.update.mockResolvedValue({ isActive: false });

      await service.getAllProducts({ page: 1 });
      await service.toggleProductStatusBySlug('chair');
      await service.getAllProducts({ page: 1 });

      expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProductBySlug', () => {
    const product = { id: 1, slug: 'chair', colors: [], productTags: [] };

    it('caches the storefront view', async () => {
      prisma.product.findUnique.mockResolvedValue(product);

      await service.getProductBySlug('chair');
      await service.getProductBySlug('chair');

      expect(prisma.product.findUnique).toHaveBeenCalledTimes(1);
    });

    it('storefront view only finds an active product', async () => {
      prisma.product.findUnique.mockResolvedValue(product);
      await service.getProductBySlug('chair');

      expect(prisma.product.findUnique.mock.calls[0][0].where).toEqual({
        slug: 'chair',
        isActive: true,
      });
    });

    it('admin view finds the product whether active or not', async () => {
      prisma.product.findUnique.mockResolvedValue(product);
      await service.getProductBySlug('chair', true);

      expect(prisma.product.findUnique.mock.calls[0][0].where).toEqual({
        slug: 'chair',
      });
    });

    it('never caches the admin view', async () => {
      prisma.product.findUnique.mockResolvedValue(product);

      await service.getProductBySlug('chair', true);
      await service.getProductBySlug('chair', true);

      expect(prisma.product.findUnique).toHaveBeenCalledTimes(2);
    });

    it('schema (SEO) only for an active product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.generateProductSchema('chair')).rejects.toThrow();

      expect(prisma.product.findUnique.mock.calls[0][0].where).toEqual({
        slug: 'chair',
        isActive: true,
      });
    });

    it('does not cache a not-found', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(service.getProductBySlug('chair')).rejects.toThrow();

      prisma.product.findUnique.mockResolvedValueOnce(product);
      await expect(service.getProductBySlug('chair')).resolves.toBeDefined();
    });
  });

  describe('resolveOrderBy', () => {
    it('maps known keys, including the storefront "featured" alias', () => {
      expect(service.resolveOrderBy('price', 'asc')).toEqual({ price: 'asc' });
      expect(service.resolveOrderBy('featured', 'desc')).toEqual({
        isFeatured: 'desc',
      });
    });

    it('returns undefined when no sort is requested, whatever order says', () => {
      expect(service.resolveOrderBy(undefined, 'asc')).toBeUndefined();
      expect(service.resolveOrderBy('', 'sideways')).toBeUndefined();
    });

    it('rejects unknown columns and orders with a 400', () => {
      expect(() => service.resolveOrderBy('passwordHash', 'asc')).toThrow(
        BadRequestException,
      );
      expect(() => service.resolveOrderBy('toString', 'asc')).toThrow(
        BadRequestException,
      );
      expect(() => service.resolveOrderBy('price', 'sideways')).toThrow(
        BadRequestException,
      );
    });
  });
});
