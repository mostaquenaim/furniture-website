import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import { PaymentMethodConfigService } from './payment-method-config.service';
import { CreatePaymentMethodConfigDto } from './dto/create-payment-method-config.dto';
import { UpdatePaymentMethodConfigDto } from './dto/update-payment-method-config.dto';

@Controller('payment-methods')
export class PaymentMethodConfigController {
  constructor(private readonly service: PaymentMethodConfigService) {}

  // Public — checkout UI uses this to know which methods to show.
  @Get()
  findActive() {
    return this.service.findActive();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PAYMENT_METHOD_VIEW)
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PAYMENT_METHOD_MANAGE)
  create(@Body() dto: CreatePaymentMethodConfigDto, @Req() req: any) {
    return this.service.create(dto, req?.user?.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PAYMENT_METHOD_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaymentMethodConfigDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req?.user?.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PAYMENT_METHOD_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req?.user?.userId);
  }
}
