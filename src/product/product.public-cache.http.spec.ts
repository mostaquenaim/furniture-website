/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  VersioningType,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { BarcodeService } from '../barcode/barcode.service';
import { ReviewService } from '../review/review.service';
import { PermissionService } from '../permission/permission.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

// Real HTTP round trips through the same CORS setup as main.ts, the real JWT
// strategy and the real RolesGuard, to check what a browser / Cloudflare /
// an anonymous caller actually gets.
describe('Product routes (HTTP)', () => {
  let app: INestApplication;
  const productService = {
    getAllProducts: jest.fn(),
    getAdminProducts: jest.fn(),
    getProductBySlug: jest.fn(),
    getProductReviews: jest.fn(),
    resolveOrderBy: ProductService.prototype.resolveOrderBy,
  };
  // PRODUCTMANAGER may view products and manage reviews, nothing else
  const permissionService = {
    isAllowed: jest.fn(
      (role: string, action: string) =>
        role === 'PRODUCTMANAGER' &&
        ['PRODUCT_VIEW', 'REVIEW_MANAGE'].includes(action),
    ),
  };
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET || 'secretkey',
  });
  const tokenFor = (role: string) =>
    `Bearer ${jwt.sign({ userId: 1, role, jti: `t-${role}` })}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: productService },
        { provide: BarcodeService, useValue: {} },
        { provide: ReviewService, useValue: {} },
        { provide: PermissionService, useValue: permissionService },
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            blackListToken: { findFirst: jest.fn().mockResolvedValue(null) },
            user: {
              findUnique: jest.fn().mockResolvedValue({ isActive: true }),
            },
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors({
      origin: ['https://ondorkotha.com', 'https://www.ondorkotha.com'],
      credentials: true,
    });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    productService.getAllProducts.mockResolvedValue({ data: [], meta: {} });
    productService.getAdminProducts.mockResolvedValue({ data: [], meta: {} });
    productService.getProductBySlug.mockResolvedValue({ slug: 'chair' });
    productService.getProductReviews.mockResolvedValue({ reviews: [] });
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);

  describe('public cache headers', () => {
    it('storefront response: shared-cacheable and origin-independent', async () => {
      for (const origin of [
        'https://ondorkotha.com',
        'https://www.ondorkotha.com',
        undefined,
      ]) {
        const req = get('/api/v1/product/chair');
        if (origin) req.set('Origin', origin);
        const res = await req.expect(200);

        expect(res.headers['cache-control']).toBe(
          'public, max-age=0, s-maxage=60',
        );
        expect(res.headers['access-control-allow-origin']).toBe('*');
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      }
    });

    it('revalidation with the ETag returns 304', async () => {
      const first = await get('/api/v1/product/chair').expect(200);
      expect(first.headers.etag).toBeDefined();

      await get('/api/v1/product/chair')
        .set('If-None-Match', first.headers.etag)
        .expect(304);
    });

    it('error responses carry no cache header', async () => {
      productService.getProductBySlug.mockRejectedValueOnce(
        new NotFoundException(),
      );
      const res = await get('/api/v1/product/missing')
        .set('Origin', 'https://ondorkotha.com')
        .expect(404);

      expect(res.headers['cache-control']).toBeUndefined();
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://ondorkotha.com',
      );
    });

    it('storefront "Featured" sort no longer 500s', async () => {
      await get('/api/v1/product/all?sortBy=featured&order=desc').expect(200);
      expect(productService.getAllProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderBy: { isFeatured: 'desc' } }),
      );
    });
  });

  describe('inactive / out-of-stock products are staff-only', () => {
    it.each([
      '/api/v1/product/all?isActive=false',
      '/api/v1/product/all?includeOutOfStock=true',
      '/api/v1/product/chair?admin=true',
    ])('public %s is refused', async (path) => {
      await get(path).expect(400);
      expect(productService.getAllProducts).not.toHaveBeenCalled();
      expect(productService.getProductBySlug).not.toHaveBeenCalled();
    });

    it.each([
      '/api/v1/product/admin/all',
      '/api/v1/product/admin/flash-sale-picker',
      '/api/v1/product/chair/admin',
    ])('%s needs a token', async (path) => {
      await get(path).expect(401);
      expect(productService.getAdminProducts).not.toHaveBeenCalled();
    });

    it('a customer token is forbidden', async () => {
      await get('/api/v1/product/admin/all')
        .set('Authorization', tokenFor('CUSTOMER'))
        .expect(403);
      expect(productService.getAdminProducts).not.toHaveBeenCalled();
    });

    it('staff without the flash-sale permission are forbidden from the picker', async () => {
      await get('/api/v1/product/admin/flash-sale-picker')
        .set('Authorization', tokenFor('PRODUCTMANAGER'))
        .expect(403);
    });

    it('staff with PRODUCT_VIEW get the full list, uncached, normal CORS', async () => {
      const res = await get(
        '/api/v1/product/admin/all?isActive=false&includeOutOfStock=true',
      )
        .set('Origin', 'https://ondorkotha.com')
        .set('Authorization', tokenFor('PRODUCTMANAGER'))
        .expect(200);

      expect(productService.getAdminProducts).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, includeOutOfStock: true }),
      );
      expect(res.headers['cache-control']).toBeUndefined();
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://ondorkotha.com',
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('superadmin passes every staff route', async () => {
      for (const path of [
        '/api/v1/product/admin/all',
        '/api/v1/product/admin/flash-sale-picker',
        '/api/v1/product/admin/reviews',
      ]) {
        await get(path)
          .set('Authorization', tokenFor('SUPERADMIN'))
          .expect(200);
      }
    });
  });

  describe('hidden reviews are staff-only', () => {
    it.each(['true', 'null', 'false'])(
      'public ?isHidden=%s is refused',
      async (v) => {
        await get(`/api/v1/product/reviews?isHidden=${v}`).expect(400);
        expect(productService.getProductReviews).not.toHaveBeenCalled();
      },
    );

    it('public list asks for visible reviews only', async () => {
      await get('/api/v1/product/reviews?productSlug=chair').expect(200);
      expect(productService.getProductReviews).toHaveBeenCalledWith(
        expect.objectContaining({ productSlug: 'chair', isHidden: false }),
      );
    });

    it('a logged-in customer still only gets visible reviews', async () => {
      await get('/api/v1/product/reviews?productSlug=chair')
        .set('Authorization', tokenFor('CUSTOMER'))
        .expect(200);
      expect(productService.getProductReviews).toHaveBeenCalledWith(
        expect.objectContaining({ isHidden: false }),
      );
    });

    it('moderation list: 401 anonymous, 403 customer, 200 with REVIEW_MANAGE', async () => {
      await get('/api/v1/product/admin/reviews?isHidden=null').expect(401);
      await get('/api/v1/product/admin/reviews?isHidden=null')
        .set('Authorization', tokenFor('CUSTOMER'))
        .expect(403);
      await get('/api/v1/product/admin/reviews?isHidden=null')
        .set('Authorization', tokenFor('PRODUCTMANAGER'))
        .expect(200);

      expect(productService.getProductReviews).toHaveBeenCalledTimes(1);
      expect(productService.getProductReviews).toHaveBeenCalledWith(
        expect.objectContaining({ isHidden: null }),
      );
    });
  });
});
