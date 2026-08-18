import { Prisma } from '@prisma/client';
import { ApiClientService } from './api-client.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { hashPassword } from 'src/common/utils/password.utils';

describe('ApiClientService', () => {
  let service: ApiClientService;
  let prisma: {
    apiClient: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let activityLog: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      apiClient: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    activityLog = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ApiClientService(
      prisma as unknown as PrismaService,
      activityLog as unknown as ActivityLogService,
    );
  });

  describe('create', () => {
    it('returns the plaintext key exactly once, alongside a bcrypt-hashed record', async () => {
      prisma.apiClient.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 1,
          name: data.name,
          keyPrefix: data.keyPrefix,
          hashedSecret: data.hashedSecret,
          scopes: data.scopes,
          status: 'ACTIVE',
          rateLimitPerMinute: data.rateLimitPerMinute,
          expiresAt: data.expiresAt,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date(),
        }),
      );

      const result = await service.create(
        { name: 'Acme', scopes: ['inventory:read'] as any },
        7,
      );

      expect(result.apiKey).toMatch(/^sk_live_/);
      expect(result.keyPrefix).toBe(result.apiKey.slice(0, 16));
      expect((result as any).hashedSecret).toBeUndefined();
      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_API_CLIENT', adminId: 7 }),
      );
    });

    it('retries with a new key on a keyPrefix collision, and eventually succeeds', async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.19.0', meta: { target: ['keyPrefix'] } },
      );
      prisma.apiClient.create
        .mockRejectedValueOnce(conflict)
        .mockImplementationOnce(({ data }) =>
          Promise.resolve({
            id: 2,
            name: data.name,
            keyPrefix: data.keyPrefix,
            hashedSecret: data.hashedSecret,
            scopes: data.scopes,
            status: 'ACTIVE',
            rateLimitPerMinute: data.rateLimitPerMinute,
            expiresAt: null,
            lastUsedAt: null,
            revokedAt: null,
            createdAt: new Date(),
          }),
        );

      const result = await service.create(
        { name: 'Acme', scopes: ['inventory:read'] as any },
        7,
      );

      expect(prisma.apiClient.create).toHaveBeenCalledTimes(2);
      expect(result.apiKey).toMatch(/^sk_live_/);
    });

    it('does not swallow unrelated database errors', async () => {
      prisma.apiClient.create.mockRejectedValue(new Error('connection lost'));
      await expect(
        service.create({ name: 'Acme', scopes: ['inventory:read'] as any }, 7),
      ).rejects.toThrow('connection lost');
    });
  });

  describe('authenticate', () => {
    it('returns invalid for a key without the sk_live_ prefix', async () => {
      const result = await service.authenticate('not-a-key');
      expect(result).toEqual({ status: 'invalid' });
      expect(prisma.apiClient.findUnique).not.toHaveBeenCalled();
    });

    it('returns invalid when the prefix is unknown', async () => {
      prisma.apiClient.findUnique.mockResolvedValue(null);
      const result = await service.authenticate('sk_live_unknownkey12345678');
      expect(result).toEqual({ status: 'invalid' });
    });

    it('returns invalid when the secret does not match', async () => {
      const hashedSecret = await hashPassword('sk_live_correctsecret12345678');
      prisma.apiClient.findUnique.mockResolvedValue({
        id: 1,
        hashedSecret,
        status: 'ACTIVE',
        expiresAt: null,
        scopes: ['inventory:read'],
        rateLimitPerMinute: 60,
        name: 'Acme',
      });

      const result = await service.authenticate('sk_live_wrongsecret12345678');
      expect(result).toEqual({ status: 'invalid' });
    });

    it('returns inactive for a revoked key even with the right secret', async () => {
      const rawKey = 'sk_live_correctsecret12345678';
      const hashedSecret = await hashPassword(rawKey);
      prisma.apiClient.findUnique.mockResolvedValue({
        id: 1,
        hashedSecret,
        status: 'REVOKED',
        expiresAt: null,
        scopes: ['inventory:read'],
        rateLimitPerMinute: 60,
        name: 'Acme',
      });

      const result = await service.authenticate(rawKey);
      expect(result).toEqual({ status: 'inactive' });
    });

    it('returns inactive for an expired key', async () => {
      const rawKey = 'sk_live_correctsecret12345678';
      const hashedSecret = await hashPassword(rawKey);
      prisma.apiClient.findUnique.mockResolvedValue({
        id: 1,
        hashedSecret,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 1000),
        scopes: ['inventory:read'],
        rateLimitPerMinute: 60,
        name: 'Acme',
      });

      const result = await service.authenticate(rawKey);
      expect(result).toEqual({ status: 'inactive' });
    });

    it('returns the client and touches lastUsedAt for a valid, active key', async () => {
      const rawKey = 'sk_live_correctsecret12345678';
      const hashedSecret = await hashPassword(rawKey);
      prisma.apiClient.findUnique.mockResolvedValue({
        id: 1,
        hashedSecret,
        status: 'ACTIVE',
        expiresAt: null,
        scopes: ['inventory:read'],
        rateLimitPerMinute: 60,
        name: 'Acme',
      });
      prisma.apiClient.update.mockResolvedValue({});

      const result = await service.authenticate(rawKey);
      expect(result).toEqual({
        status: 'active',
        client: {
          id: 1,
          name: 'Acme',
          scopes: ['inventory:read'],
          rateLimitPerMinute: 60,
        },
      });
      expect(prisma.apiClient.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });
  });

  describe('revoke', () => {
    it('is idempotent — revoking an already-revoked key does not write or log again', async () => {
      prisma.apiClient.findUnique.mockResolvedValue({
        id: 1,
        status: 'REVOKED',
        name: 'Acme',
      });

      await service.revoke(1, 7);

      expect(prisma.apiClient.update).not.toHaveBeenCalled();
      expect(activityLog.log).not.toHaveBeenCalled();
    });

    it('revokes an active key and logs the change', async () => {
      prisma.apiClient.findUnique.mockResolvedValue({
        id: 1,
        status: 'ACTIVE',
        name: 'Acme',
      });
      prisma.apiClient.update.mockResolvedValue({
        id: 1,
        status: 'REVOKED',
        name: 'Acme',
      });

      await service.revoke(1, 7);

      expect(prisma.apiClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'REVOKED' }),
        }),
      );
      expect(activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REVOKE_API_CLIENT' }),
      );
    });
  });
});
