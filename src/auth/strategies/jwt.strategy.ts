/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'secretkey',
    });
  }

  // Every authenticated request passes through here — the single chokepoint
  // to enforce logout (blacklisted jti) and account deactivation/suspension
  // (isActive), neither of which was previously checked anywhere.
  async validate(payload: any) {
    const blacklisted = await this.prisma.blackListToken.findFirst({
      where: { jti: payload.jti },
    });
    if (blacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return {
      userId: payload.userId,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
