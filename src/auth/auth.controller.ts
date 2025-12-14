/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Controller, Post, Body, Get, Put, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    console.log(dto,'regdto');
    return this.authService.register(dto);
  }
 
  @Post('verify-otp')
  verifyOtp(
    @Body() body: { emailOrPhone: string, code: string, type: 'email' | 'phone', keepSignedIn: boolean}
  ) {
    console.log(body);
    return this.authService.verifyOtp(body.emailOrPhone, body.code, body.type, body.keepSignedIn);
  }

  @Post('signin')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return this.authService.profile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Req() req, @Body() data) {
    return this.authService.updateProfile(req.user.userId, data);
  }

  // TODO: implement logout, forgot-password, reset-password, verify-phone, verify-email, 2FA, refresh-token
}
