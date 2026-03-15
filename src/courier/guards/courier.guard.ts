/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

type SignatureMode = 'plain' | 'hmac-sha256';

interface ProviderConfig {
  /** CIDR ranges or exact IPs. Empty array = skip IP check. */
  allowedIps: string[];
  signatureHeader?: string;
  signatureSecretEnvKey?: string;
  signatureMode?: SignatureMode;
}

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  pathao: {
    allowedIps: [],
    signatureHeader: 'x-pathao-merchant-webhook-integration-secret',
    signatureSecretEnvKey: 'PATHAO_WEBHOOK_SECRET',
    signatureMode: 'plain', // Pathao echoes your secret as-is
  },
  steadfast: {
    allowedIps: ['103.139.192.0/24'],
    // No signature header — IP check only
  },
  redx: {
    allowedIps: [],
    // Add signatureHeader if RedX provides one
  },
  paperfly: {
    allowedIps: [],
    // Add signatureHeader if Paperfly provides one
  },
};

@Injectable()
export class CourierWebhookGuard implements CanActivate {
  private readonly logger = new Logger(CourierWebhookGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const provider = req.params.provider?.toLowerCase();
    const cfg = PROVIDER_CONFIG[provider];

    if (!cfg) {
      this.logger.warn(`Webhook rejected — unknown provider: "${provider}"`);
      throw new UnauthorizedException(`Unknown courier provider: ${provider}`);
    }

    const clientIp = this.extractIp(req);
    this.logger.debug(`Webhook — provider="${provider}" ip="${clientIp}"`);

    // ── 1. IP whitelist ────────────────────────────────────────────────────
    if (
      cfg.allowedIps.length > 0 &&
      !this.isIpAllowed(clientIp, cfg.allowedIps)
    ) {
      this.logger.warn(
        `Webhook rejected — IP "${clientIp}" not whitelisted for "${provider}"`,
      );
      throw new UnauthorizedException('Request origin not allowed');
    }

    // ── 2. Secret / signature header ───────────────────────────────────────
    if (cfg.signatureHeader && cfg.signatureSecretEnvKey) {
      const incoming = req.headers[cfg.signatureHeader] as string | undefined;
      const secret = this.config.get<string>(cfg.signatureSecretEnvKey);

      if (!secret) {
        this.logger.error(
          `Guard misconfigured — "${cfg.signatureSecretEnvKey}" env key not set`,
        );
        throw new UnauthorizedException('Webhook secret not configured');
      }

      if (!incoming) {
        this.logger.warn(
          `Webhook rejected — missing header "${cfg.signatureHeader}" for "${provider}"`,
        );
        throw new UnauthorizedException('Missing webhook verification header');
      }

      const mode = cfg.signatureMode ?? 'plain';

      if (mode === 'plain') {
        if (!this.timingSafeEqual(secret, incoming)) {
          this.logger.warn(
            `Webhook rejected — secret mismatch for "${provider}"`,
          );
          throw new UnauthorizedException('Invalid webhook secret');
        }
      } else {
        // hmac-sha256: compare hex(HMAC-SHA256(secret, rawBody))
        const rawBody: Buffer | undefined = (req as any).rawBody;
        if (!rawBody) {
          this.logger.error(
            'rawBody unavailable — set rawBody:true in NestFactory.create()',
          );
          throw new UnauthorizedException('Cannot verify webhook signature');
        }

        const expected = crypto
          .createHmac('sha256', secret)
          .update(rawBody)
          .digest('hex');
        const normalised = incoming.replace(/^sha256=/, '');

        if (!this.timingSafeEqual(expected, normalised)) {
          this.logger.warn(
            `Webhook rejected — HMAC mismatch for "${provider}"`,
          );
          throw new UnauthorizedException('Invalid webhook signature');
        }
      }
    }

    return true;
  }
  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return first.split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? '';
  }

  private isIpAllowed(ip: string, cidrs: string[]): boolean {
    for (const entry of cidrs) {
      if (entry === ip) return true;
      if (entry.includes('/') && this.ipInCidr(ip, entry)) return true;
    }
    return false;
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bits] = cidr.split('/');
      const mask = ~((1 << (32 - Number(bits))) - 1) >>> 0;
      return (this.ipToInt(ip) & mask) === (this.ipToInt(range) & mask);
    } catch {
      return false;
    }
  }

  private ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, o) => ((acc << 8) | Number(o)) >>> 0, 0);
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }
}
