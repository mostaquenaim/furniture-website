/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { RefundDto } from './dto/refund.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('create')
  create(@Req() req, @Body() dto: CreateOrderDto) {
    // console.log(req?.user?.userId);
    return this.orderService.createOrder(req?.user?.userId, dto);
  }

  ////////////////////////////
  //////OTHERS////////////
  ///////////////////////////

  @Post(':id/return')
  return(@Param('id', ParseIntPipe) id: number, @Body() dto: ReturnOrderDto) {
    return this.orderService.returnOrder(id, dto);
  }

  @Get(':id/invoice')
  invoice(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.generateInvoice(id);
  }

  @Post(':id/ship')
  ship(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.shipOrder(id);
  }

  @Get(':id/tracking')
  tracking(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.getTracking(id);
  }

  @Post(':id/refund')
  refund(@Param('id', ParseIntPipe) id: number, @Body() dto: RefundDto) {
    return this.orderService.refundPayment(id, dto);
  }
}
