/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('all')
  getAllOrders(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: OrderStatus,
    @Query('sortBy') sortBy?: 'createdAt' | 'total' | 'status',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query('thumb') thumb?: boolean,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
  // console.log(page, 'page');

    return this.orderService.getAllOrders(req?.user?.userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 5,
      search,
      status,
      orderBy: sortBy ? { [sortBy]: order } : undefined,
      thumb,
      from,
      to,
    });
  }

  @Post('create')
  create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(req?.user?.userId, dto);
  }

  @Get('/track/:orderId')
  trackOrder(
    @Req() req,
    @Param('orderId') orderId: string,
    @Query('details') details: string,
  ) {
    const detailsValue = details === 'true';

    return this.orderService.trackOrder(req?.user?.userId, orderId, {
      detailsValue,
    });
  }
}
