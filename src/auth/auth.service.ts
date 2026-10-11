/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { hashPassword, comparePassword } from 'src/common/utils/password.utils';
import { SAFE_USER_SELECT } from 'src/user/safe-user.select';
import * as crypto from 'crypto';
import { UpdateUserDto } from 'src/user/dto/update-user.dto';
import { ChangePasswordDto } from './dto/ChangePasswordDto.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GoogleUserDto } from './dto/google-user.dto';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { checkOtpSend, claimOtp } from 'src/common/utils/otp.utils';

const MAX_ATTEMPTS = 5;
const BLOCK_TIME_MINUTES = 15;

// Customers stay signed in until they log out: their token lasts
// CUSTOMER_SESSION_DAYS and the frontend renews it (POST /auth/refresh) while
// they keep visiting. Staff tokens are short and never renewed.
export const CUSTOMER_SESSION_DAYS = 90;
const STAFF_SESSION: JwtSignOptions['expiresIn'] = '7d';

export function sessionLength(role: string): JwtSignOptions['expiresIn'] {
  return role === 'CUSTOMER' ? `${CUSTOMER_SESSION_DAYS}d` : STAFF_SESSION;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {}

  async sendOtp(
    userId: number,
    type: 'email' | 'phone',
    email?: string,
    phone?: string,
    purpose?:
      | 'REGISTER'
      | 'ADMIN_LOGIN'
      | 'SIGN_IN'
      | 'UPDATE_EMAIL'
      | 'UPDATE_PHONE'
      | 'VERIFY_EMAIL'
      | 'VERIFY_PHONE',
  ) {
    const target = type === 'email' ? { email } : { phone };
    const echoCode =
      process.env.RENDER === 'true' || process.env.NODE_ENV === 'development';

    // A code sent to the same place in the last minute is still valid: keep
    // it instead of sending another message. Throws 429 past the hourly cap.
    const recent = await checkOtpSend(
      this.prisma,
      { userId, type, ...target },
      target,
    );
    if (recent) {
      return echoCode
        ? recent.code
        : { message: `An OTP was sent to your ${type} less than a minute ago` };
    }

    await this.prisma.oTP.updateMany({
      where: {
        userId,
        type,
        verified: false,
      },
      data: { expiresAt: new Date() },
    });

    const code = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oTP.create({
      data: { userId, code, type, expiresAt, email, phone },
    });

    if (type === 'email' && email) {
      await this.notificationQueue.add('sendEmail', {
        email: email,
        subject: 'Your OTP Code',
        template: 'otp',
        context: {
          otp: code,
          purpose,
        },
      });
    }

    if (type === 'phone' && phone) {
      await this.notificationQueue.add('sendSMS', {
        phone: phone,
        message: `Your Ondorkotha OTP is ${code}. It will expire in 5 minutes.`,
      });
    }

    if (echoCode) {
      return code;
    }

    return { message: `OTP sent to your ${type}` };
  }

  async login(dto: LoginDto) {
    const identifier = dto?.email || dto?.phone;

    if (!identifier) {
      throw new BadRequestException('Email or phone is required for login');
    }

    // Check brute force before processing
    await this.checkBruteForce(identifier);

    const user = await this.prisma.user.findUnique({
      where: dto.phone ? { phone: dto.phone } : { email: dto.email },
    });

    if (!user) {
      await this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('User not found');
    }

    const passwordVerified = Boolean(user.password && dto.password);

    if (passwordVerified) {
      const valid = await comparePassword(
        dto.password as string,
        user.password as string,
      );

      if (!valid) {
        await this.recordFailedAttempt(identifier);
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    await this.resetAttempts(identifier);

    if (user.role === 'CUSTOMER') {
      if (!user.isVerified) {
        throw new UnauthorizedException('Account not verified');
      }
    }

    // Password-only sign-in (no OTP) outside real production. render.yaml pins
    // NODE_ENV=production on the Render deploy (required for `npm install` to
    // pull devDependencies during build — see DEPLOYMENT.md), so NODE_ENV alone
    // can't tell that demo apart from a genuine prod env; RENDER=true (auto-set
    // by the Render platform on every service) is the actual signal for it.
    const isDevOrRenderDemo =
      process.env.NODE_ENV !== 'production' || process.env.RENDER === 'true';

    if (passwordVerified && isDevOrRenderDemo) {
      return this.issueToken(user, sessionLength(user.role));
    }

    const otpType: 'email' | 'phone' = dto.email ? 'email' : 'phone';

    const otpDetails = await this.sendOtp(
      user.id,
      otpType,
      otpType === 'email' ? dto.email : undefined,
      otpType === 'phone' ? dto.phone : undefined,
      'SIGN_IN',
    );

    return {
      status: 'OTP_REQUIRED',
      otpSentTo: otpType,
      userId: user.id,
      otpDetails,
    };
  }

  // `sid` names the sign-in session: renewed tokens keep it, and logout
  // revokes it, so every token ever issued for that sign-in stops working
  async issueToken(
    user: any,
    expiresIn: JwtSignOptions['expiresIn'],
    sid: string = crypto.randomUUID(),
  ) {
    const jti = crypto.randomUUID();

    const payload = {
      userId: user.id,
      role: user.role,
      jti,
      sid,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn,
    });

    const { password, ...safeUser } = user;
    return { user: safeUser, token };
  }

  // New token for the same session, so an active customer is never signed
  // out. Called with a token the JwtStrategy already accepted.
  async refreshSession(auth: { userId: number; sid?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException('Staff sessions are not renewed');
    }

    // The old token stays valid until its own expiry: blacklisting it here
    // would 401 requests already in flight with it. Tokens from before
    // session ids (no sid) start a new session.
    return this.issueToken(user, sessionLength(user.role), auth.sid);
  }

  async verifyOtp(
    emailOrPhone: string,
    code: string,
    type: 'email' | 'phone',
  ) {
    const user = await this.prisma.user.findFirst({
      where:
        type === 'email' ? { email: emailOrPhone } : { phone: emailOrPhone },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Only a code sent to this email/phone counts, and each code allows
    // OTP_MAX_ATTEMPTS checks
    const otpData = await claimOtp(
      this.prisma,
      {
        userId: user.id,
        type,
        ...(type === 'email' ? { email: emailOrPhone } : { phone: emailOrPhone }),
      },
      code,
    );

    if (!otpData) throw new UnauthorizedException('Invalid or expired OTP');

    await this.prisma.$transaction([
      this.prisma.oTP.update({
        where: { id: otpData.id },
        data: { verified: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      }),
    ]);

    return this.issueToken(user, sessionLength(user.role));
  }

  // `newValue` is the email/phone being switched to: only a code sent there
  // proves the user owns it
  async verifyUpdateOtp(
    userId: number,
    code: string,
    type: 'email' | 'phone',
    newValue: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    if (!user) throw new UnauthorizedException('User is not found');

    const otpData = await claimOtp(
      this.prisma,
      {
        userId: user.id,
        type,
        ...(type === 'email' ? { email: newValue } : { phone: newValue }),
      },
      code,
    );

    if (!otpData) throw new UnauthorizedException('Invalid or expired OTP');

    await this.prisma.oTP.update({
      where: { id: otpData.id },
      data: { verified: true },
    });

    return user;
  }

  async verifyEmailOrPhone(emailOrPhone: string, type: 'email' | 'phone') {
    if (!emailOrPhone) throw new NotFoundException('not found');

    const user = await this.prisma.user.findFirst({
      where:
        type === 'email' ? { email: emailOrPhone } : { phone: emailOrPhone },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return await this.sendOtp(
      user.id,
      type,
      type === 'email' ? emailOrPhone : undefined,
      type === 'phone' ? emailOrPhone : undefined,
      type === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE',
    );
  }

  async register(dto: RegisterDto) {
    const phoneOwner = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (phoneOwner?.isVerified) {
      throw new ConflictException('Phone number is already registered.');
    }

    if (dto.email) {
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailOwner && emailOwner.id !== phoneOwner?.id) {
        if (emailOwner.isVerified) {
          throw new ConflictException('Email is already registered.');
        }
        // An unverified sign-up can't sign in, so it has no claim on the email
        await this.prisma.user.update({
          where: { id: emailOwner.id },
          data: { email: null },
        });
      }
    }

    const hashedPassword = dto.password
      ? await hashPassword(dto.password)
      : null;
    const data = {
      name: dto.name,
      email: dto.email ?? null,
      password: hashedPassword,
    };

    // Re-registering an unverified phone reuses that user instead of deleting
    // it: a delete would fail (or cascade) once the user has carts, views etc.
    // sendOtp expires the previous unverified OTPs.
    const user = phoneOwner
      ? await this.prisma.user.update({ where: { id: phoneOwner.id }, data })
      : await this.prisma.user.create({
          data: { ...data, phone: dto.phone, isVerified: false, role: 'CUSTOMER' },
        });

    // Phone is the required sign-in identity, so that's what gets verified
    const otpType = 'phone';

    const otpDetails = await this.sendOtp(
      user.id,
      otpType,
      undefined,
      dto.phone,
      'REGISTER',
    );

    return {
      status: 'OTP_REQUIRED',
      otpSentTo: otpType,
      userId: user.id,
      otpDetails,
    }; // frontend switches to OTP view
  }

  async profile(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
  }

  // Explicitly whitelisted here (not just at the DTO layer) so a future
  // caller passing a raw object can never smuggle role/isActive/password
  // into a Prisma update — see PUT /auth/profile mass-assignment fix.
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const data: Pick<UpdateProfileDto, 'name' | 'email' | 'phone'> = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
    };

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: SAFE_USER_SELECT,
      });

      return updatedUser;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const fields = (error.meta?.target as string[])?.join(', ') || 'field';
        throw new ConflictException(
          `An account with this ${fields} already exists`,
        );
      }
      throw error;
    }
  }

  async addToBlacklist(jti: string, exp: number) {
    const expiryDate = exp * 1000; // convert seconds to ms
    await this.prisma.blackListToken.create({
      data: {
        jti,
        expiry: expiryDate,
      },
    });
  }

  // Revokes this token and, through its session id, every renewed copy of
  // it. Session ids share the blacklist's jti column (both are UUIDs).
  async logout(auth: { jti: string; sid?: string; exp: number }) {
    await this.addToBlacklist(auth.jti, auth.exp);
    if (auth.sid) {
      const latestPossibleExp =
        Math.floor(Date.now() / 1000) + CUSTOMER_SESSION_DAYS * 86_400;
      await this.addToBlacklist(auth.sid, latestPossibleExp);
    }
  }

  async checkBruteForce(identifier: string) {
    const record = await this.prisma.loginAttempt.findUnique({
      where: { identifier },
    });

    if (!record) return;

    // Check if blocked
    if (record.blockedUntil && record.blockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (record.blockedUntil.getTime() - Date.now()) / (60 * 1000),
      );
      throw new UnauthorizedException(
        `Too many attempts. Try again after ${remainingMinutes} minutes`,
      );
    }

    // Reset attempts if last attempt was more than BLOCK_TIME_MINUTES ago
    if (
      record.lastAttempt &&
      new Date().getTime() - record.lastAttempt.getTime() >
        BLOCK_TIME_MINUTES * 60 * 1000
    ) {
      await this.prisma.loginAttempt.delete({
        where: { identifier },
      });
    }
  }

  async recordFailedAttempt(identifier: string) {
    const record = await this.prisma.loginAttempt.findUnique({
      where: { identifier },
    });

    const now = new Date();
    const attempts = record ? record.attempts + 1 : 1;

    // Calculate blockedUntil if attempts reach MAX_ATTEMPTS
    const blockedUntil =
      attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + BLOCK_TIME_MINUTES * 60 * 1000)
        : null;

    if (!record) {
      await this.prisma.loginAttempt.create({
        data: {
          identifier,
          attempts,
          lastAttempt: now,
          blockedUntil,
        },
      });
    } else {
      await this.prisma.loginAttempt.update({
        where: { identifier },
        data: {
          attempts,
          lastAttempt: now,
          blockedUntil,
        },
      });
    }
  }

  async resetAttempts(identifier: string) {
    await this.prisma.loginAttempt
      .delete({
        where: { identifier },
      })
      .catch(() => {});
  }

  // Moves a guest's data into the account they just signed into: their guest
  // orders, their cart (combined with the account cart if there is one) and
  // their recently-viewed products.
  async mergeGuestData(visitorId: string, userId: number) {
    if (typeof visitorId !== 'string' || !visitorId || visitorId.length > 100) {
      throw new BadRequestException('visitorId required');
    }

    return this.prisma.$transaction(async (tx) => {
      const visitor = await tx.visitor.findUnique({ where: { id: visitorId } });

      // A device already linked to a different account (e.g. a shared
      // browser that kept its visitorId) must not hand that person's guest
      // orders or cart to whoever signs in next.
      if (visitor?.userId && visitor.userId !== userId) {
        return {
          ordersMerged: 0,
          cart: 'none' as const,
          reason: 'VISITOR_LINKED_TO_OTHER_USER',
        };
      }

      await tx.visitor.upsert({
        where: { id: visitorId },
        update: { userId },
        create: { id: visitorId, userId },
      });

      // visitorId is kept on the orders for reference; guest order lists
      // filter on userId: null, so these stop showing as guest orders.
      const { count: ordersMerged } = await tx.order.updateMany({
        where: { visitorId, userId: null },
        data: { userId },
      });

      // (productId, userId, visitorId) is unique; these rows keep their
      // visitorId, so setting userId can't collide with the account's own
      // (visitorId: null) views.
      await tx.productView.updateMany({
        where: { visitorId, userId: null },
        data: { userId },
      });

      const cart = await this.mergeGuestCart(tx, visitorId, userId);

      return { ordersMerged, cart };
    });
  }

  private async mergeGuestCart(
    tx: Prisma.TransactionClient,
    visitorId: string,
    userId: number,
  ): Promise<'none' | 'moved' | 'combined'> {
    const guestCart = await tx.cart.findFirst({
      where: { visitorId, userId: null, status: 'ACTIVE' },
      include: { items: { include: { productSize: true } } },
    });
    if (!guestCart) return 'none';

    const userCart = await tx.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { items: true },
    });

    if (!userCart) {
      // Claim with a conditional update so two concurrent logins can't both
      // take the same guest cart.
      const { count } = await tx.cart.updateMany({
        where: { id: guestCart.id, userId: null, status: 'ACTIVE' },
        data: { visitorId: null, userId },
      });
      return count === 1 ? 'moved' : 'none';
    }

    const { count } = await tx.cart.updateMany({
      where: { id: guestCart.id, status: 'ACTIVE' },
      data: { status: 'ABANDONED' },
    });
    if (count !== 1) return 'none';

    for (const item of guestCart.items) {
      // Cap at live stock; the cart refresh on the next read handles a size
      // that has since sold out entirely.
      const stockCap = Math.max(1, item.productSize.quantity);
      const existing = userCart.items.find(
        (u) => u.productSizeId === item.productSizeId,
      );

      if (existing) {
        // Same size in both carts: one line with the combined quantity
        // (cartId + productSizeId is unique, so it can't be moved across).
        const quantity = Math.min(existing.quantity + item.quantity, stockCap);
        await tx.cartItem.update({
          where: { id: existing.id },
          data: {
            quantity,
            subtotalAtAdd: existing.priceAtAdd * quantity,
            baseSubtotalAtAdd: existing.basePriceAtAdd * quantity,
          },
        });
        await tx.cartItem.delete({ where: { id: item.id } });
      } else {
        const quantity = Math.min(item.quantity, stockCap);
        await tx.cartItem.update({
          where: { id: item.id },
          data: {
            cartId: userCart.id,
            quantity,
            subtotalAtAdd: item.priceAtAdd * quantity,
            baseSubtotalAtAdd: item.basePriceAtAdd * quantity,
          },
        });
      }
    }

    const items = await tx.cartItem.findMany({
      where: { cartId: userCart.id },
    });
    await tx.cart.update({
      where: { id: userCart.id },
      data: {
        subtotalAtAdd: items.reduce((s, i) => s + i.subtotalAtAdd, 0),
        baseSubtotalAtAdd: items.reduce((s, i) => s + i.baseSubtotalAtAdd, 0),
      },
    });

    return 'combined';
  }

  async update(userId: number, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const emailChanging = dto.email && dto.email !== user.email;
    const phoneChanging = dto.phone && dto.phone !== user.phone;

    if (emailChanging && phoneChanging) {
      throw new BadRequestException(
        'Please update email or phone one at a time',
      );
    }

    if (emailChanging || phoneChanging) {
      const type: 'email' | 'phone' = emailChanging ? 'email' : 'phone';
      const newValue = type === 'email' ? dto.email : dto.phone;

      if (!dto.otp) {
        return {
          status: 'OTP_REQUIRED',
          otp: await this.sendOtp(
            user.id,
            type,
            emailChanging ? dto.email : undefined,
            phoneChanging ? dto.phone : undefined,
            emailChanging ? 'UPDATE_EMAIL' : 'UPDATE_PHONE',
          ),
        };
      } else {
        if (newValue) {
          await this.verifyUpdateOtp(userId, dto.otp, type, newValue);
        }
      }
    }

    // Update only provided fields
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name ?? user.name,
        email: dto.email ?? user.email,
        phone: dto.phone ?? user.phone,
      },
      select: SAFE_USER_SELECT,
    });

    return {
      success: true,
      user: updatedUser,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found');

    if (!user.password) {
      throw new UnauthorizedException('Please login with Google');
    }

    const isOldValid = await comparePassword(dto.oldPassword, user.password);

    if (!isOldValid) {
      throw new BadRequestException('Old password is incorrect');
    }

    const hashedPassword = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async findOrCreateGoogleUser(googleUser: GoogleUserDto) {
    const { email, name, avatar, googleId } = googleUser;

    // Case 1 & 2: find by googleId first, then fall back to email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (user) {
      // Link Google account to existing email account if not already linked
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId, avatar: avatar ?? user.avatar },
        });
      }
      return user;
    }

    // Case 3: new user via Google
    user = await this.prisma.user.create({
      data: {
        email,
        name,
        avatar,
        googleId,
        role: 'CUSTOMER',
      },
    });

    return user;
  }
}
