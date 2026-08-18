/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
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

const MAX_ATTEMPTS = 5;
const BLOCK_TIME_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {}

  async sendOtp(
    userId: number,
    type: 'email' | 'phone' | '',
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

    if (
      process.env.NODE_ENV === 'vercel' ||
      process.env.NODE_ENV === 'development'
    ) {
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

    if (user.password && dto.password) {
      const valid = await comparePassword(dto.password, user.password);

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

    const otpType: 'email' | 'phone' | '' = dto.email ? 'email' : 'phone';

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

  async issueToken(user: any, expiresIn: JwtSignOptions['expiresIn']) {
    const jti = crypto.randomUUID();

    const payload = {
      userId: user.id,
      role: user.role,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn,
    });

    const { password, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async verifyOtp(
    emailOrPhone: string,
    code: string,
    type: 'email' | 'phone',
    keepSignedIn: boolean,
  ) {
    const user = await this.prisma.user.findFirst({
      where:
        type === 'email' ? { email: emailOrPhone } : { phone: emailOrPhone },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const otpData = await this.prisma.oTP.findFirst({
      where: {
        userId: user.id,
        code,
        type,
        verified: false,
        expiresAt: { gte: new Date() },
      },
    });

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

    return this.issueToken(user, keepSignedIn ? '1d' : '30d');
  }

  async verifyUpdateOtp(userId: number, code: string, type: 'email' | 'phone') {
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

    const otpData = await this.prisma.oTP.findFirst({
      where: {
        userId: user.id,
        code,
        type,
        verified: false,
        expiresAt: { gte: new Date() },
      },
    });

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
    // Check if email or phone already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email ?? undefined }, // only check if email is provided
          { phone: dto.phone ?? undefined }, // only check if phone is provided
        ],
      },
    });

    if (existingUser) {
      if (existingUser.isVerified) {
        throw new ConflictException('Phone number is already registered.');
      }
      // If phone exists but not verified, allow re-registration to trigger new OTP
      await this.prisma.oTP.deleteMany({
        where: {
          userId: existingUser.id,
          type: 'phone',
          verified: false,
        },
      });

      await this.prisma.user.delete({
        where: { id: existingUser.id },
      });
    }

    let hashedPassword = '';
    if (dto.password) {
      hashedPassword = await hashPassword(dto.password);
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        password: hashedPassword || null,
        isVerified: false,
        role: 'CUSTOMER',
      },
    });

    const otpType: 'email' | 'phone' = dto.email ? 'email' : 'phone';

    const otpDetails = await this.sendOtp(
      user.id,
      otpType,
      dto.email,
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

  async mergeGuestData(visitorId: string, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Link visitor to user (always do this first)
      await tx.visitor.upsert({
        where: { id: visitorId },
        update: { userId },
        create: { id: visitorId, userId },
      });

      const userCart = await tx.cart.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (userCart) {
        // Abort cart movement, but visitor is already linked
        return { merged: false, reason: 'USER_CART_EXISTS' };
      }

      const guestCart = await tx.cart.findFirst({
        where: {
          visitorId,
          status: 'ACTIVE',
        },
      });

      if (!guestCart) {
        return { merged: false, reason: 'NO_GUEST_CART' };
      }

      await tx.cart.update({
        where: { id: guestCart.id },
        data: {
          visitorId: null,
          userId,
        },
      });

      return { merged: true };
    });
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
          await this.verifyUpdateOtp(userId, dto.otp, type);
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
