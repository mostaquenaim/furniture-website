import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get() getAll() { return this.service.getAll(); }
  @Put() updateAll(@Body() body: any) { return this.service.updateAll(body); }

  @Get('payment') getPayment() { return this.service.getPayment(); }
  @Put('payment') updatePayment(@Body() body: any) { return this.service.updatePayment(body); }

  @Get('shipping') getShipping() { return this.service.getShipping(); }
  @Put('shipping') updateShipping(@Body() body: any) { return this.service.updateShipping(body); }

  @Get('email') getEmail() { return this.service.getEmail(); }
  @Put('email') updateEmail(@Body() body: any) { return this.service.updateEmail(body); }

  @Get('sms') getSms() { return this.service.getSms(); }
  @Put('sms') updateSms(@Body() body: any) { return this.service.updateSms(body); }
}
