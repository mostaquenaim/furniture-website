import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import { SettingsService } from './settings.service';

// Every route here can surface credential-shaped data (payment gateway
// `config`, SMTP password, SMS API key) except `shipping`, which is just a
// fee number + public district names — so only `shipping` reads are public.
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  getAll() { return this.service.getAll(); }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  updateAll(@Body() body: any) { return this.service.updateAll(body); }

  // Real data now — see PaymentMethodConfigController for the actual CRUD
  // (create/update/delete individual gateway configs). Admin-only: this
  // includes the `config` field, which can hold gateway API keys/secrets.
  @Get('payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PAYMENT_METHOD_VIEW)
  getPayment() { return this.service.getPayment(); }

  @Get('shipping') getShipping() { return this.service.getShipping(); }

  @Put('shipping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  updateShipping(@Body() body: { defaultCharge?: number }) {
    return this.service.updateShipping(body);
  }

  @Get('email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  getEmail() { return this.service.getEmail(); }

  @Put('email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  updateEmail(@Body() body: any) { return this.service.updateEmail(body); }

  @Get('sms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  getSms() { return this.service.getSms(); }

  @Put('sms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SETTINGS_MANAGE)
  updateSms(@Body() body: any) { return this.service.updateSms(body); }
}
