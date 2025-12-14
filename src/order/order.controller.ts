import { Controller, Get, Post, Put, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { RefundDto } from './dto/refund.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  getUserOrders(@Param('userId') userId: number) {
    return this.orderService.getUserOrders(userId);
  }

  @Get('all')
  getAllOrders() {
    return this.orderService.getAllOrders();
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get(':id')
  getOrder(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.getOrderById(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto) {
    return this.orderService.updateOrder(id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelOrderDto) {
    return this.orderService.cancelOrder(id, dto);
  }

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
