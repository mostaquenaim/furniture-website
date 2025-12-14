/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async sendOtp(userId: number, type: 'email' | 'phone') {
    const code = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.oTP.create({
      data: { userId, code, type, expiresAt },
    });

    // TODO: send OTP via email or SMS
    if (type === 'email') {
      console.log(`Send email OTP to user: ${code}`);
    } else {
      console.log(`Send SMS OTP to user: ${code}`);
    }

    return { message: `OTP sent to your ${type}` };
  }

  async verifyOtp(userId: number, code: string, type: 'email' | 'phone') {
    const otpData = await this.prisma.oTP.findFirst({
      where: { userId, code, type, verified: false, expiresAt: { gte: new Date() } },
    });

    if (!otpData) throw new UnauthorizedException('Invalid or expired OTP');

    // const currentTime = new Date();
    // const otpCreationTime = new Date(otp.createdAt);

    await this.prisma.oTP.update({
      where: { id: otpData.id },
      data: { verified: true },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const token = this.jwtService.sign({ userId: user?.id, role: user?.role });
    return { user, access_token: token };
  }

 async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
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
    await this.sendOtp(user.id, otpType);

    return { userId: user.id, otpSentTo: otpType }; // frontend will switch to OTP view
  }


  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ userId: user.id, role: user.role });
    return { user, token };
  }

  async profile(userId: number) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async updateProfile(userId: number, data: any) {
    return this.prisma.user.update({ where: { id: userId }, data });
  }
}
