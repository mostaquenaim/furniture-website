/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

const MAX_ATTEMPTS = 5;
const BLOCK_TIME_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async sendOtp(
    userId: number,
    type: 'email' | 'phone' | '',
    email?: string,
    phone?: string,
  ) {
    const code = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oTP.create({
      data: { userId, code, type, expiresAt, email, phone },
    });

    // TODO: send OTP via email or SMS
    if (type === 'email') {
      console.log(`Send email OTP to user: ${code}`);
    } else {
      console.log(`Send SMS OTP to user: ${code}`);
    }

    return { message: `OTP sent to your ${type}` };
  }

  async verifyOtp(
    emailOrPhone: string,
    code: string,
    type: 'email' | 'phone',
    keepSignedIn: boolean,
  ) {
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

    await this.prisma.oTP.update({
      where: { id: otpData.id },
      data: { verified: true },
    });

    const jti = crypto.randomUUID();

    const payload = {
      userId: user.id,
      role: user.role,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: keepSignedIn ? '30d' : '1d',
    });

    const { password, ...safeUser } = user;

    return { user: safeUser, token };
  }

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
      // Determine which field is taken
      if (existingUser.email === dto.email) {
        throw new Error('Email is already registered.');
      }
      if (existingUser.phone === dto.phone) {
        throw new Error('Phone number is already registered.');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create new user
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        password: hashedPassword,
      },
    });

    // Send OTP
    const otpType: 'email' | 'phone' = dto.email ? 'email' : 'phone';
    await this.sendOtp(user.id, otpType, dto.email, dto.phone);

    return { userId: user.id, otpSentTo: otpType }; // frontend switches to OTP view
  }

  async login(dto: LoginDto) {
    // Use clientIp from DTO, fallback to empty string
    const identifier = dto?.clientIp || dto?.email || dto?.phone;
    // console.log(identifier, 'identifier');

    // Check brute force before processing
    await this.checkBruteForce(identifier);

    const user = await this.prisma.user.findUnique({
      where: dto.phone ? { phone: dto.phone } : { email: dto.email },
    });

    if (!user) {
      await this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('User not found');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset attempts on successful login
    await this.resetAttempts(identifier);

    // let otpType: 'email' | 'phone' | '' = '';

    if (user.role !== 'CUSTOMER') {
      const jti = crypto.randomUUID();

      const payload = {
        userId: user.id,
        role: user.role,
        jti,
      };

      const token = await this.jwtService.signAsync(payload, {
        expiresIn: '1d',
      });

      const { password, ...safeUser } = user;

      return { user: safeUser, token };
    }

    // customer 
    /*  */
    const otpType: 'email' | 'phone' | '' = dto.email ? 'email' : 'phone';

    await this.sendOtp(user.id, otpType, dto.email, dto.phone);

    return { userId: user.id, otpSentTo: otpType };
  }

  // get profile
  async profile(userId: number) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async updateProfile(userId: number, data: any) {
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  // Store blacklisted token in the database
  async addToBlacklist(jti: string, exp: number) {
    const expiryDate = Date.now() + exp * 1000; // convert seconds to ms

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
      throw new Error(
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
}
