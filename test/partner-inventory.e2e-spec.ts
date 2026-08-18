/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Exercises the partner inventory API against the real app (same
// ValidationPipe / global prefix / versioning main.ts applies), including
// the full admin-issues-a-key -> partner-consumes-it lifecycle, the
// documented error contract, cursor pagination, and — critically — that
// none of this touches the existing admin /inventory auth.
describe('Partner Inventory API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken: string;
  let productSizeIds: number[] = [];
  const cleanupIds = {
    userId: undefined as number | undefined,
    productId: undefined as number | undefined,
    productColorId: undefined as number | undefined,
    colorId: undefined as number | undefined,
    variantId: undefined as number | undefined,
    sizeId: undefined as number | undefined,
    apiClientIds: [] as number[],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    prisma = app.get(PrismaService);

    const admin = await prisma.user.create({
      data: {
        email: `partner-e2e-admin-${Date.now()}@test.local`,
        name: 'E2E Admin',
        role: 'SUPERADMIN',
        isActive: true,
        isVerified: true,
      },
    });
    cleanupIds.userId = admin.id;
    const jwtService = app.get(JwtService);
    adminToken = await jwtService.signAsync(
      { userId: admin.id, role: admin.role, jti: randomUUID() },
      { expiresIn: '1h' },
    );

    const product = await prisma.product.create({
      data: {
        title: 'E2E Test Sofa',
        slug: `e2e-test-sofa-${Date.now()}`,
        basePrice: 1000,
      },
    });
    cleanupIds.productId = product.id;
    const color = await prisma.color.create({ data: { name: 'E2E Blue' } });
    cleanupIds.colorId = color.id;
    const productColor = await prisma.productColor.create({
      data: { productId: product.id, colorId: color.id },
    });
    cleanupIds.productColorId = productColor.id;
    const variant = await prisma.variant.create({
      data: { name: 'E2E Variant' },
    });
    cleanupIds.variantId = variant.id;
    const size = await prisma.size.create({
      data: { name: 'E2E Size', variantId: variant.id },
    });
    cleanupIds.sizeId = size.id;

    const rowA = await prisma.productSize.create({
      data: {
        sku: 'E2E-A',
        quantity: 20,
        lowStockAt: 5,
        colorId: productColor.id,
        sizeId: size.id,
      },
    });
    const rowB = await prisma.productSize.create({
      data: {
        sku: 'E2E-B',
        quantity: 1,
        lowStockAt: 5,
        colorId: productColor.id,
        sizeId: size.id,
      },
    });
    productSizeIds = [rowA.id, rowB.id];
  });

  afterAll(async () => {
    await prisma.apiKeyRequestLog.deleteMany({
      where: { apiClientId: { in: cleanupIds.apiClientIds } },
    });
    await prisma.apiClient.deleteMany({
      where: { id: { in: cleanupIds.apiClientIds } },
    });
    await prisma.productSize.deleteMany({
      where: { id: { in: productSizeIds } },
    });
    if (cleanupIds.productColorId) {
      await prisma.productColor.delete({
        where: { id: cleanupIds.productColorId },
      });
    }
    if (cleanupIds.colorId) {
      await prisma.color.delete({ where: { id: cleanupIds.colorId } });
    }
    if (cleanupIds.sizeId) {
      await prisma.size.delete({ where: { id: cleanupIds.sizeId } });
    }
    if (cleanupIds.variantId) {
      await prisma.variant.delete({ where: { id: cleanupIds.variantId } });
    }
    if (cleanupIds.productId) {
      await prisma.product.delete({ where: { id: cleanupIds.productId } });
    }
    if (cleanupIds.userId) {
      // The admin actions above (create/revoke) wrote ActivityLog rows
      // that FK-reference this user — clear those first or the delete
      // below violates ActivityLog_adminId_fkey.
      await prisma.activityLog.deleteMany({
        where: { adminId: cleanupIds.userId },
      });
      await prisma.user.delete({ where: { id: cleanupIds.userId } });
    }
    await app.close();
  });

  it('lets a SUPERADMIN create a partner API key', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/api-clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Partner', scopes: ['inventory:read'] })
      .expect(201);

    expect(res.body.apiKey).toMatch(/^sk_live_/);
    expect(res.body.hashedSecret).toBeUndefined();
    cleanupIds.apiClientIds.push(res.body.id);
  });

  describe('using an issued key', () => {
    let apiKey: string;
    let apiClientId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/api-clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Consumer', scopes: ['inventory:read'] })
        .expect(201);
      apiKey = res.body.apiKey;
      apiClientId = res.body.id;
      cleanupIds.apiClientIds.push(apiClientId);
    });

    it('lists inventory with the stable partner DTO shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory')
        .set('X-Api-Key', apiKey)
        .expect(200);

      const row = res.body.data.find((r: any) => productSizeIds.includes(r.id));
      expect(row).toMatchObject({
        sku: expect.any(String),
        productTitle: 'E2E Test Sofa',
        size: 'E2E Size',
        color: 'E2E Blue',
      });
      expect(row.hashedSecret).toBeUndefined();
      expect(res.body.meta).toEqual(
        expect.objectContaining({ count: expect.any(Number) }),
      );
    });

    it('fetches a single row by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/partner/inventory/${productSizeIds[0]}`)
        .set('X-Api-Key', apiKey)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: productSizeIds[0],
        quantity: 20,
      });
    });

    it('filters low-stock items correctly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory/low-stock')
        .set('X-Api-Key', apiKey)
        .expect(200);

      const ids = res.body.data.map((r: any) => r.id);
      expect(ids).toContain(productSizeIds[1]); // quantity 1 <= lowStockAt 5
      expect(ids).not.toContain(productSizeIds[0]); // quantity 20 > lowStockAt 5
    });

    it('paginates by cursor without skipping or repeating rows', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory')
        .query({ limit: 1 })
        .set('X-Api-Key', apiKey)
        .expect(200);
      expect(page1.body.data).toHaveLength(1);
      expect(page1.body.meta.nextCursor).toBeTruthy();

      const page2 = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory')
        .query({ limit: 1, cursor: page1.body.meta.nextCursor })
        .set('X-Api-Key', apiKey)
        .expect(200);

      expect(page2.body.data[0]?.id).not.toBe(page1.body.data[0].id);
    });

    it('returns the stable error envelope for a validation failure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory')
        .query({ limit: 9999 })
        .set('X-Api-Key', apiKey)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns the stable error envelope for an unknown id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory/999999999')
        .set('X-Api-Key', apiKey)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects requests with no key at all', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory')
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_API_KEY');
    });

    it('rejects an unknown key', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory')
        .set('X-Api-Key', 'sk_live_totallywrongkey00000000')
        .expect(401);

      expect(res.body.error.code).toBe('INVALID_API_KEY');
    });

    it('rejects a revoked key with 403, and it stays rejected', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/api-clients/${apiClientId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/partner/inventory')
        .set('X-Api-Key', apiKey)
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  it('never touches the admin /inventory route — still requires a staff JWT', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/inventory')
      .expect(401);
    expect(res.body).not.toHaveProperty('error.code'); // admin route keeps Nest's default shape, untouched

    await request(app.getHttpServer())
      .get('/api/v1/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('rejects an unscoped key with FORBIDDEN even though it authenticates', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/api-clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E No-op key', scopes: ['inventory:read'] })
      .expect(201);
    cleanupIds.apiClientIds.push(res.body.id);

    await prisma.apiClient.update({
      where: { id: res.body.id },
      data: { scopes: [] },
    });

    const partnerRes = await request(app.getHttpServer())
      .get('/api/v1/partner/inventory')
      .set('X-Api-Key', res.body.apiKey)
      .expect(403);
    expect(partnerRes.body.error.code).toBe('FORBIDDEN');
  });
});
