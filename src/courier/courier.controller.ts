/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/courier/courier.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CourierService } from './courier.service';
import { CreateCourierShipmentDto } from './dto/create-courier-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { CourierWebhookDto } from './dto/courier-webhook.dto';
import { CalculateRateDto } from './dto/calculate-rate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';

@Controller('courier')
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Post('shipments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createShipment(@Body() dto: CreateCourierShipmentDto) {
    return this.courierService.createShipment(dto);
  }

  @Get('providers')
  getProviders() {
    return this.courierService.getProviders();
  }

  @Post('rates/calculate')
  async calculateRates(@Body() dto: CalculateRateDto) {
    return this.courierService.calculateRates(dto);
  }

  @Get('shipments/order/:orderId')
  @UseGuards(JwtAuthGuard)
  async getOrderShipments(
    @Param('orderId') orderId: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.courierService.getShipmentTracking(
      parseInt(orderId),
      providerId ? parseInt(providerId) : undefined,
    );
  }

  @Patch('shipments/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateShipmentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.courierService.updateShipmentStatus(parseInt(id), dto);
  }

  @Post('shipments/:id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async syncShipmentStatus(@Param('id') id: string) {
    return this.courierService.syncShipmentStatus(parseInt(id));
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() dto: CourierWebhookDto) {
    return this.courierService.handleWebhook(dto);
  }
}
