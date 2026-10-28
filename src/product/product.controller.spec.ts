/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { BarcodeService } from '../barcode/barcode.service';
import { ReviewService } from '../review/review.service';
import { PermissionService } from '../permission/permission.service';
import { PERMISSION_KEY } from '../permission/permission.decorator';

const mockRes = () =>
  ({
    headersSent: false,
    setHeader: jest.fn(),
    removeHeader: jest.fn(),
  }) as any;

const guardsOf = (method: (...args: any[]) => any) =>
  (Reflect.getMetadata('__guards__', method) ?? []).map((g: any) => g.name);
const permissionOf = (method: (...args: any[]) => any) =>
  Reflect.getMetadata(PERMISSION_KEY, method);

describe('ProductController', () => {
  let controller: ProductController;
  let productService: Record<string, jest.Mock | ((...args: any[]) => any)>;

  beforeEach(async () => {
    productService = {
      getAllProducts: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      getAdminProducts: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      getProductBySlug: jest.fn().mockResolvedValue({ slug: 'chair' }),
      getProductReviews: jest.fn().mockResolvedValue({ reviews: [] }),
      // the real sort parsing, not a stand-in
      resolveOrderBy: ProductService.prototype.resolveOrderBy,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: productService },
        { provide: BarcodeService, useValue: {} },
        { provide: ReviewService, useValue: {} },
        { provide: PermissionService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /product/all (storefront)', () => {
    it('marks the listing as publicly cacheable', async () => {
      const res = mockRes();
      await controller.getAllProducts(res, { page: '1', limit: '18' });

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=0, s-maxage=60',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*',
      );
      expect(res.removeHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Credentials',
      );
    });

    it('never passes isActive / includeOutOfStock to the service', async () => {
      await controller.getAllProducts(mockRes(), { page: '2', limit: '18' });

      const params = (productService.getAllProducts as jest.Mock).mock
        .calls[0][0];
      expect(params).not.toHaveProperty('isActive');
      expect(params).not.toHaveProperty('includeOutOfStock');
      expect(params).toMatchObject({ page: 2, limit: 18 });
    });

    it.each([
      [{ isActive: 'false' }],
      [{ isActive: 'true' }],
      [{ includeOutOfStock: 'true' }],
    ])('refuses the staff-only param %j', async (query) => {
      const res = mockRes();
      await expect(controller.getAllProducts(res, query)).rejects.toThrow(
        BadRequestException,
      );
      expect(productService.getAllProducts).not.toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('sends no cache headers when the query fails', async () => {
      const res = mockRes();
      (productService.getAllProducts as jest.Mock).mockRejectedValueOnce(
        new Error('db down'),
      );

      await expect(controller.getAllProducts(res, {})).rejects.toThrow(
        'db down',
      );
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('rejects an unknown sort column before querying', async () => {
      await expect(
        controller.getAllProducts(mockRes(), { sortBy: 'nope' }),
      ).rejects.toThrow(BadRequestException);
      expect(productService.getAllProducts).not.toHaveBeenCalled();
    });

    it('ignores a non-string search (repeated ?search=)', async () => {
      await controller.getAllProducts(mockRes(), { search: ['a', 'b'] });
      expect(
        (productService.getAllProducts as jest.Mock).mock.calls[0][0].search,
      ).toBeUndefined();
    });
  });

  describe('staff product listings', () => {
    it('admin list passes the staff filters through, uncached', async () => {
      await controller.getAdminProducts({
        isActive: 'false',
        includeOutOfStock: 'true',
        page: '1',
        limit: '10',
      });
      expect(productService.getAdminProducts).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, includeOutOfStock: true }),
      );
    });

    it('admin list needs JWT + PRODUCT_VIEW', () => {
      const m = ProductController.prototype.getAdminProducts;
      expect(guardsOf(m)).toEqual(['JwtAuthGuard', 'RolesGuard']);
      expect(permissionOf(m)).toBe('PRODUCT_VIEW');
    });

    it('flash-sale picker needs JWT + FLASH_SALE_MANAGE', () => {
      const m = ProductController.prototype.getFlashSalePickerProducts;
      expect(guardsOf(m)).toEqual(['JwtAuthGuard', 'RolesGuard']);
      expect(permissionOf(m)).toBe('FLASH_SALE_MANAGE');
    });
  });

  describe('GET /product/:slug', () => {
    it('serves the storefront view with cache headers', async () => {
      const res = mockRes();
      await controller.getProductById(res, 'chair');

      expect(productService.getProductBySlug).toHaveBeenCalledWith('chair');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=0, s-maxage=60',
      );
    });

    it('refuses the old public ?admin=true view', async () => {
      const res = mockRes();
      await expect(
        controller.getProductById(res, 'chair', 'true'),
      ).rejects.toThrow(BadRequestException);
      expect(productService.getProductBySlug).not.toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('sends no cache headers for a not-found product', async () => {
      const res = mockRes();
      (productService.getProductBySlug as jest.Mock).mockRejectedValueOnce(
        new Error('not found'),
      );

      await expect(controller.getProductById(res, 'nope')).rejects.toThrow();
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('GET /product/:slug/admin', () => {
    it('returns the full admin view', async () => {
      await controller.getProductForAdmin('chair');
      expect(productService.getProductBySlug).toHaveBeenCalledWith(
        'chair',
        true,
      );
    });

    it('is guarded by JWT + PRODUCT_UPDATE', () => {
      const m = ProductController.prototype.getProductForAdmin;
      expect(guardsOf(m)).toEqual(['JwtAuthGuard', 'RolesGuard']);
      expect(permissionOf(m)).toBe('PRODUCT_UPDATE');
    });
  });

  describe('reviews', () => {
    it('public list always asks for visible reviews only', async () => {
      await controller.getProductReviews({ productSlug: 'chair' });
      expect(productService.getProductReviews).toHaveBeenCalledWith(
        expect.objectContaining({ productSlug: 'chair', isHidden: false }),
      );
    });

    it.each([['true'], ['null'], ['false']])(
      'public list refuses isHidden=%s',
      async (isHidden) => {
        await expect(
          controller.getProductReviews({ isHidden }),
        ).rejects.toThrow(BadRequestException);
        expect(productService.getProductReviews).not.toHaveBeenCalled();
      },
    );

    it('admin list can include hidden reviews', async () => {
      await controller.getAdminProductReviews({ isHidden: 'null' });
      expect(productService.getProductReviews).toHaveBeenCalledWith(
        expect.objectContaining({ isHidden: null }),
      );

      await controller.getAdminProductReviews({ isHidden: 'true' });
      expect(productService.getProductReviews).toHaveBeenLastCalledWith(
        expect.objectContaining({ isHidden: true }),
      );
    });

    it('admin list needs JWT + REVIEW_MANAGE', () => {
      const m = ProductController.prototype.getAdminProductReviews;
      expect(guardsOf(m)).toEqual(['JwtAuthGuard', 'RolesGuard']);
      expect(permissionOf(m)).toBe('REVIEW_MANAGE');
    });
  });
});
