import { HttpException } from '@nestjs/common';
import type { OTP, Prisma, PrismaClient } from '@prisma/client';

// Limits shared by every OTP the app sends (sign-up, sign-in, reset,
// profile changes, orders), so SMS cost per number stays bounded
export const OTP_COOLDOWN_MS = 60_000;
export const OTP_HOURLY_LIMIT = 5;
export const OTP_MAX_ATTEMPTS = 5;

type Db = Pick<PrismaClient, 'oTP'>;
type Target = { phone?: string | null; email?: string | null };

// Call before sending. Returns the caller's own live code if one was sent
// within the cooldown: reuse it instead of sending another message. Throws
// 429 once the phone (or email) has had OTP_HOURLY_LIMIT codes in the last
// hour, counted across every OTP type.
export async function checkOtpSend(
  db: Db,
  scope: Prisma.OTPWhereInput,
  target: Target,
): Promise<OTP | null> {
  const now = Date.now();

  const recent = await db.oTP.findFirst({
    where: {
      ...scope,
      verified: false,
      createdAt: { gte: new Date(now - OTP_COOLDOWN_MS) },
      expiresAt: { gt: new Date(now) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) return recent;

  const to = target.phone
    ? { phone: target.phone }
    : target.email
      ? { email: target.email }
      : null;
  if (to) {
    const sentLastHour = await db.oTP.count({
      where: { ...to, createdAt: { gte: new Date(now - 3_600_000) } },
    });
    if (sentLastHour >= OTP_HOURLY_LIMIT) {
      throw new HttpException(
        {
          statusCode: 429,
          code: 'OTP_LIMIT',
          message: `Too many OTP requests for this ${target.phone ? 'number' : 'email'}. Please try again later.`,
        },
        429,
      );
    }
  }

  return null;
}

// Checks `code` against the latest live code matching `scope`. Every check,
// right or wrong, uses one of OTP_MAX_ATTEMPTS attempts on that code. Returns
// the OTP on a match, otherwise null. Use the root client, never a
// transaction that might roll the attempt back.
export async function claimOtp(
  db: Db,
  scope: Prisma.OTPWhereInput,
  code: string,
): Promise<OTP | null> {
  const otp = await db.oTP.findFirst({
    where: {
      ...scope,
      verified: false,
      expiresAt: { gt: new Date() },
      attempts: { lt: OTP_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return null;

  // Postgres serializes this UPDATE, so racing requests can't exceed the cap
  const claimed = await db.oTP.updateMany({
    where: { id: otp.id, verified: false, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0 || otp.code !== code) return null;

  return otp;
}
