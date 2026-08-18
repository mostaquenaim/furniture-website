/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Req,
  Query,
  Patch,
  Res,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/ChangePasswordDto.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { ConfigService } from '@nestjs/config';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('reset-password')
  verifyEmailOrPhone(
    @Body() body: { emailOrPhone: string; type: 'email' | 'phone' },
  ) {
    return this.authService.verifyEmailOrPhone(body.emailOrPhone, body.type);
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req?.user?.userId, dto);
  }

  @Post('verify-otp')
  verifyOtp(
    @Body()
    body: {
      emailOrPhone: string;
      code: string;
      type: 'email' | 'phone';
      keepSignedIn: boolean;
    },
  ) {
    return this.authService.verifyOtp(
      body.emailOrPhone,
      body.code,
      body.type,
      body.keepSignedIn,
    );
  }

  @Post('signin')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return this.authService.profile(req?.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req?.user?.userId, dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    const tokenJti = req?.user?.jti;
    // Real unix-seconds expiry from the token's own `exp` claim (JwtStrategy
    // passes it through) — addToBlacklist converts it to ms internally.
    const exp = req?.user?.exp;

    await this.authService.addToBlacklist(tokenJti, exp);

    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('merge-user')
  async mergeUser(@Req() req: any, @Query('visitorId') visitorId: string) {
    await this.authService.mergeGuestData(visitorId, req?.user?.userId);
  }

  // ── Redirect user to Google consent screen ──────────────────────────
  // Version-neutral: GOOGLE_CALLBACK_URL below is registered as a fixed
  // redirect URI in Google Cloud Console, so this path must not move.
  @Version(VERSION_NEUTRAL)
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Passport handles the redirect — no body needed
  }

  // Google redirects back here with the user profile ────────────────
  @Version(VERSION_NEUTRAL)
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const error = (req as any).query?.error;

    // User cancelled Google login
    if (error === 'access_denied') {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      return res.redirect(`${frontendUrl}/auth/google/cancelled`);
    }

    const user = req?.user as any;

    const keepSignedIn = false; // Google users — reasonable default
    const expiresIn = keepSignedIn ? '30d' : '1d';

    // Issue your own JWT (same shape as your regular login token)
    const { token } = await this.authService.issueToken(user, expiresIn);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    // Redirect to frontend with token in query param
    // Frontend reads it once, stores in localStorage, then strips from URL
    return res.redirect(
      `${frontendUrl}/auth/google/success?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`,
    );
  }
}
