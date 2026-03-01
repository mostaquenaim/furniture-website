/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/ChangePasswordDto.dto';
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
    // console.log('we are here');
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
    // console.log(body);
    return this.authService.verifyOtp(
      body.emailOrPhone,
      body.code,
      body.type,
      body.keepSignedIn,
    );
  }

  @Post('signin')
  login(@Body() dto: LoginDto) {
    // console.log(LoginDto);
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return this.authService.profile(req?.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Req() req, @Body() data) {
    return this.authService.updateProfile(req?.user?.userId, data);
  }

  //logout
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    // console.log(req, 'qqqqqqqqqqqqqqq');
    const tokenJti = req?.user?.jti;
    const exp = 3600;

    await this.authService.addToBlacklist(tokenJti, exp);

    return { message: 'Logged out successfully' };
  }

  // merge user
  @UseGuards(JwtAuthGuard)
  @Patch('merge-user')
  async mergeUser(@Req() req: any, @Query('visitorId') visitorId: string) {
    console.log(visitorId, 'vistoriffs');
    await this.authService.mergeGuestData(visitorId, req?.user?.userId);
  }

  // ── Redirect user to Google consent screen ──────────────────────────
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Passport handles the redirect — no body needed
  }

  // Google redirects back here with the user profile ────────────────
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
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
