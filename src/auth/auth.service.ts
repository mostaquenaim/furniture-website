/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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

  // send otp
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
        // purpose,
        verified: false,
      },
      data: { expiresAt: new Date() },
    });

    const code = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oTP.create({
      data: { userId, code, type, expiresAt, email, phone },
    });

    // console.log('the type is', type);

    // TODO: send OTP via email or SMS
    if (type === 'email') {
      // console.log(`Send email OTP to user: ${code}`);
    } else {
      // console.log(`Send SMS OTP to user: ${code}`);
    }

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

  // login
  async login(dto: LoginDto) {
    // console.log(dto, 'logindto');
    // Use clientIp from DTO, fallback to empty string
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

    // console.log(user.password, dto.password, 'passwords');

    if (user.password && dto.password) {
      // console.log('im in');
      // throw new UnauthorizedException('Please login with Google');
      const valid = await comparePassword(dto.password, user.password);

      if (!valid) {
        await this.recordFailedAttempt(identifier);
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    // console.log('before reset');
    // Reset attempts on successful login
    await this.resetAttempts(identifier);

    // console.log('after reset');

    if (user.role === 'CUSTOMER') {
      // console.log('customer yes');

      if (!user.isVerified) {
        throw new UnauthorizedException('Account not verified');
      }

      // return this.issueToken(user, '1d');
    }

    // console.log('not customer');

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

  // issue token
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

  // verify otp
  async verifyOtp(
    emailOrPhone: string,
    code: string,
    type: 'email' | 'phone',
    keepSignedIn: boolean,
  ) {
    // console.log(emailOrPhone, code, type);

    // Find the user first
    const user = await this.prisma.user.findFirst({
      where:
        type === 'email' ? { email: emailOrPhone } : { phone: emailOrPhone },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // console.log(emailOrPhone, code, type, user);

    const otpData = await this.prisma.oTP.findFirst({
      where: {
        userId: user.id,
        code,
        type,
        verified: false,
        expiresAt: { gte: new Date() },
      },
    });

    // console.log('otpData', otpData);

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

  // verify update otp
  async verifyUpdateOtp(userId: number, code: string, type: 'email' | 'phone') {
    // console.log(userId, code, type);
    // console.log(userId, code, type);

    // Find the user first
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });

    // console.log(user);

    if (!user) throw new UnauthorizedException('User is not found');

    // console.log(emailOrPhone, code, type, user);

    const otpData = await this.prisma.oTP.findFirst({
      where: {
        userId: user.id,
        code,
        type,
        verified: false,
        expiresAt: { gte: new Date() },
      },
    });

    // console.log('otpData', otpData);

    if (!otpData) throw new UnauthorizedException('Invalid or expired OTP');

    // const otpUpdate =
    await this.prisma.oTP.update({
      where: { id: otpData.id },
      data: { verified: true },
    });

    return user;
  }

  // verify email or phone
  async verifyEmailOrPhone(emailOrPhone: string, type: 'email' | 'phone') {
    // console.log(emailOrPhone);

    if (!emailOrPhone) throw new NotFoundException('not found');

    const user = await this.prisma.user.findFirst({
      where:
        type === 'email' ? { email: emailOrPhone } : { phone: emailOrPhone },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // console.log(user, 'userrr');

    // Send OTP
    return await this.sendOtp(
      user.id,
      type,
      type === 'email' ? emailOrPhone : undefined,
      type === 'phone' ? emailOrPhone : undefined,
      type === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE',
    );
  }

  // register
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
        where: { id: existingUser.id }, // delete unverified user to allow new registration
      });
    }

    // Hash password
    let hashedPassword = '';
    if (dto.password) {
      hashedPassword = await hashPassword(dto.password);
    }

    // Create new user
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

    // Send OTP
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

  // get profile
  async profile(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });
  }

  // update profile
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
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
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

  // Store blacklisted token in the database
  async addToBlacklist(jti: string, exp: number) {
    const expiryDate = exp * 1000; // convert seconds to ms
    await this.prisma.blackListToken.create({
      data: {
        jti,
        expiry: expiryDate,
      },
    });
  }

  // Update checkBruteForce to properly calculate time
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

  // Update recordFailedAttempt
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

  // Keep resetAttempts as is
  async resetAttempts(identifier: string) {
    await this.prisma.loginAttempt
      .delete({
        where: { identifier },
      })
      .catch(() => {});
  }

  // merge visitor/user data
  async mergeGuestData(visitorId: string, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // Link visitor to user (always do this first)
      await tx.visitor.upsert({
        where: { id: visitorId },
        update: { userId },
        create: { id: visitorId, userId },
      });

      // Check if user already has an active cart
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

      // Find guest active cart
      const guestCart = await tx.cart.findFirst({
        where: {
          visitorId,
          status: 'ACTIVE',
        },
      });

      if (!guestCart) {
        return { merged: false, reason: 'NO_GUEST_CART' };
      }

      // Move cart ownership
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

  // update profile
  async update(userId: number, dto: UpdateUserDto) {
    // console.log(userId, dto, 'dtoooo');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Determine if email or phone is being updated
    const emailChanging = dto.email && dto.email !== user.email;
    const phoneChanging = dto.phone && dto.phone !== user.phone;

    if (emailChanging && phoneChanging) {
      throw new BadRequestException(
        'Please update email or phone one at a time',
      );
    }

    if (emailChanging || phoneChanging) {
      // Type of OTP needed
      const type: 'email' | 'phone' = emailChanging ? 'email' : 'phone';
      const newValue = type === 'email' ? dto.email : dto.phone;

      if (!dto.otp) {
        // Send OTP if not provided
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
        // throw new BadRequestException(`OTP required for ${type} change`);
      } else {
        // Verify OTP
        if (newValue) {
          const user = await this.verifyUpdateOtp(userId, dto.otp, type);

          // console.log(user, 'founduser');
        }

        // console.log('new value nai');
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
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    return {
      success: true,
      user: updatedUser,
    };
  }

  // change password
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

  // find or create google user
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
