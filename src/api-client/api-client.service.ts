import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiClient, ApiClientStatus, Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import {
  comparePassword,
  hashPassword,
} from 'src/common/utils/password.utils';
import { CreateApiClientDto } from './dto/create-api-client.dto';

const KEY_PREFIX_TAG = 'sk_live_';
const RANDOM_LENGTH = 32;
// How many random characters (beyond the tag) are stored/displayed as the
// lookup prefix. The rest of the key is never seen again after creation.
const PREFIX_VISIBLE_RANDOM_CHARS = 8;
const MAX_CREATE_ATTEMPTS = 3;

export interface AuthenticatedApiClient {
  id: number;
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
}

type ApiClientAuthResult =
  | { status: 'invalid' }
  | { status: 'inactive' }
  | { status: 'active'; client: AuthenticatedApiClient };

@Injectable()
export class ApiClientService {
  private readonly logger = new Logger(ApiClientService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  private generateKey(): { fullKey: string; keyPrefix: string } {
    const fullKey = `${KEY_PREFIX_TAG}${nanoid(RANDOM_LENGTH)}`;
    const keyPrefix = fullKey.slice(
      0,
      KEY_PREFIX_TAG.length + PREFIX_VISIBLE_RANDOM_CHARS,
    );
    return { fullKey, keyPrefix };
  }

  private isUniquePrefixConflict(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      Array.isArray(err.meta?.target) &&
      (err.meta.target as string[]).includes('keyPrefix')
    );
  }

  private toSummary(client: ApiClient) {
    return {
      id: client.id,
      name: client.name,
      keyPrefix: client.keyPrefix,
      scopes: client.scopes,
      status: client.status,
      rateLimitPerMinute: client.rateLimitPerMinute,
      expiresAt: client.expiresAt,
      lastUsedAt: client.lastUsedAt,
      revokedAt: client.revokedAt,
      createdAt: client.createdAt,
    };
  }

  // Returns the plaintext key exactly once — nowhere else in this service
  // (or anywhere downstream) is the raw key ever readable again.
  async create(dto: CreateApiClientDto, adminId: number) {
    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
      const { fullKey, keyPrefix } = this.generateKey();
      const hashedSecret = await hashPassword(fullKey);

      try {
        const client = await this.prisma.apiClient.create({
          data: {
            name: dto.name,
            keyPrefix,
            hashedSecret,
            scopes: dto.scopes,
            rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            createdByAdminId: adminId,
          },
        });

        await this.activityLogService.log({
          adminId,
          action: 'CREATE_API_CLIENT',
          module: 'INVENTORY',
          targetId: client.id,
          targetLabel: client.name,
          newValue: { scopes: client.scopes, keyPrefix: client.keyPrefix },
        });

        return { ...this.toSummary(client), apiKey: fullKey };
      } catch (err) {
        if (this.isUniquePrefixConflict(err)) {
          this.logger.warn(
            'API key prefix collision on create — retrying with a new key',
          );
          continue;
        }
        throw err;
      }
    }

    throw new InternalServerErrorException(
      'Failed to generate a unique API key after several attempts — please retry.',
    );
  }

  async list() {
    const clients = await this.prisma.apiClient.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return clients.map((client) => this.toSummary(client));
  }

  async revoke(id: number, adminId: number) {
    const client = await this.prisma.apiClient.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`API client #${id} not found`);
    }

    if (client.status === ApiClientStatus.REVOKED) {
      return this.toSummary(client); // already revoked — idempotent, not an error
    }

    const updated = await this.prisma.apiClient.update({
      where: { id },
      data: { status: ApiClientStatus.REVOKED, revokedAt: new Date() },
    });

    await this.activityLogService.log({
      adminId,
      action: 'REVOKE_API_CLIENT',
      module: 'INVENTORY',
      targetId: id,
      targetLabel: client.name,
      oldValue: { status: client.status },
      newValue: { status: updated.status },
    });

    return this.toSummary(updated);
  }

  // Distinguishes "unknown/wrong key" (→ 401) from "known key that's
  // revoked or expired" (→ 403) so the guard can throw the right status.
  // Never returns or logs the raw key — callers only ever see the prefix.
  async authenticate(rawKey: string): Promise<ApiClientAuthResult> {
    if (!rawKey.startsWith(KEY_PREFIX_TAG)) {
      return { status: 'invalid' };
    }

    const keyPrefix = rawKey.slice(
      0,
      KEY_PREFIX_TAG.length + PREFIX_VISIBLE_RANDOM_CHARS,
    );
    const client = await this.prisma.apiClient.findUnique({
      where: { keyPrefix },
    });
    if (!client) {
      return { status: 'invalid' };
    }

    const secretMatches = await comparePassword(rawKey, client.hashedSecret);
    if (!secretMatches) {
      return { status: 'invalid' };
    }

    const isExpired =
      client.expiresAt !== null && client.expiresAt.getTime() < Date.now();
    if (client.status !== ApiClientStatus.ACTIVE || isExpired) {
      return { status: 'inactive' };
    }

    this.touchLastUsed(client.id);

    return {
      status: 'active',
      client: {
        id: client.id,
        name: client.name,
        scopes: client.scopes,
        rateLimitPerMinute: client.rateLimitPerMinute,
      },
    };
  }

  // Fire-and-forget — must never block or fail the request it's attached to.
  private touchLastUsed(id: number): void {
    this.prisma.apiClient
      .update({ where: { id }, data: { lastUsedAt: new Date() } })
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to update lastUsedAt for API client #${id}: ${String(err)}`,
        ),
      );
  }
}
