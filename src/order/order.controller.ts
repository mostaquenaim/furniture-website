/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';
import { RefundService } from '../refund/refund.service';
import { CreateReturnRequestDto } from '../refund/dto/create-return-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly refundService: RefundService,
  ) {}

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

  // ── Returns (customer-facing)
  @Get('return-requests')
  listMyReturnRequests(@Req() req: any, @Query('orderId') orderId?: string) {
    return this.refundService.listMyReturnRequests(req?.user?.userId, orderId);
  }

  @Get('return-requests/:id')
  getMyReturnRequest(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.refundService.getReturnRequestForCustomer(
      id,
      req?.user?.userId,
    );
  }

  @Patch('return-requests/:id/cancel')
  cancelMyReturnRequest(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.refundService.cancelReturnRequest(id, req?.user?.userId);
  }

  @Post(':orderId/return-request')
  createReturnRequest(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: CreateReturnRequestDto,
  ) {
    return this.refundService.createReturnRequest(
      orderId,
      dto,
      req?.user?.userId,
      req?.user?.role !== 'CUSTOMER',
    );
  }
}
