/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { FraudStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface FraudApiResponse {
  ok: boolean;
  overall?: {
    total: number;
    delivered: number;
    returned: number;
    success_ratio: number;
  };
  fraud_reports?: {
    count: number;
    risk: { level: string; score: number };
  };
}

function computeFraudStatus(data: FraudApiResponse): FraudStatus {
  const score = data.fraud_reports?.risk?.score ?? 0;
  const count = data.fraud_reports?.count ?? 0;
  const level = (data.fraud_reports?.risk?.level ?? 'Low').toLowerCase();
  const total = data.overall?.total ?? 0;
  const returned = data.overall?.returned ?? 0;
  const rawRatio = data.overall?.success_ratio ?? 0;

  // API may return 0–100 or 0–1; normalize to 0–1
  const successRatio = rawRatio > 1 ? rawRatio / 100 : rawRatio;
  // Return rate is only meaningful once there is real order volume
  const returnRate = total > 0 ? returned / total : 0;

  // ── BLOCKED ───────────────────────────────────────────────────────────────
  // Strong signals from FraudSpyBD or an extreme return pattern
  if (
    score >= 70 ||
    count >= 5 ||
    ['high', 'critical', 'very high'].includes(level) ||
    (total >= 5 && returnRate >= 0.8)
  ) {
    return FraudStatus.BLOCKED;
  }

  // ── SUSPICIOUS ────────────────────────────────────────────────────────────
  // Moderate external risk or a notable return pattern
  if (
    score >= 40 ||
    count >= 2 ||
    level === 'medium' ||
    (total >= 3 && returnRate >= 0.5) ||
    (count >= 1 && returnRate >= 0.3)
  ) {
    return FraudStatus.SUSPICIOUS;
  }

  // ── SAFE ──────────────────────────────────────────────────────────────────
  // Requires positive proof: real history + good success rate + clean record.
  // Zero-history customers intentionally cannot reach SAFE.
  if (total >= 3 && successRatio >= 0.7 && count === 0 && score < 20) {
    return FraudStatus.SAFE;
  }

  // ── DOUBTFUL ──────────────────────────────────────────────────────────────
  // Default for anyone who hasn't proven trustworthy:
  // weak negative signals, borderline history, or zero courier history (new customer).
  return FraudStatus.DOUBTFUL;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async checkFraudByPhone(phone: string) {
    const url = process.env.FRAUDURL;
    const apiKey = process.env.FRAUD_SPY_BD_API_KEY;

    if (!url || !apiKey) {
      throw new InternalServerErrorException(
        'Fraud check API is not configured',
      );
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: apiKey.startsWith('Bearer ')
          ? apiKey
          : `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ phone }),
    });

    if (!res.ok) {
      throw new InternalServerErrorException(
        `Fraud API responded with ${res.status}`,
      );
    }

    const data = (await res.json()) as FraudApiResponse;

    const overall = data.overall ?? {
      total: 0,
      delivered: 0,
      returned: 0,
      success_ratio: 0,
    };
    const reports = data.fraud_reports ?? {
      count: 0,
      risk: { level: 'Low', score: 0 },
    };
    const computedStatus = computeFraudStatus(data);

    const user = await this.prisma.user.findUnique({ where: { phone } });

    await this.prisma.fraudCheck.create({
      data: {
        phone,
        totalOrders: overall.total,
        delivered: overall.delivered,
        returned: overall.returned,
        successRatio: overall.success_ratio,
        fraudReportCount: reports.count,
        riskLevel: reports.risk.level,
        riskScore: reports.risk.score,
        computedStatus,
        ...(user && { userId: user.id }),
      },
    });

    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fraudStatus: computedStatus },
      });
    }

    return {
      fraudStatus: computedStatus,
      riskScore: reports.risk.score,
      riskLevel: reports.risk.level,
      fraudReports: reports.count,
      totalOrders: overall.total,
      returned: overall.returned,
      successRatio: overall.success_ratio,
      userAutoUpdated: !!user,
    };
  }

  async updateUserFraudStatus(userId: number, status: FraudStatus) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { fraudStatus: status },
      select: { id: true, name: true, phone: true, fraudStatus: true },
    });
  }

  async getUsers(params: {
    page: number;
    limit: number;
    fraudStatus?: FraudStatus;
    search?: string;
  }) {
    const { page, limit, fraudStatus, search } = params;
    const skip = (page - 1) * limit;

    const where = {
      ...(fraudStatus && { fraudStatus }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          fraudStatus: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  getFraudHistory(phone: string) {
    return this.prisma.fraudCheck.findMany({
      where: { phone },
      orderBy: { checkedAt: 'desc' },
    });
  }
}
