/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { RefundDto } from './dto/refund.dto';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  // User orders
  getUserOrders(userId: number) {
    return this.prisma.order.findMany({ where: { userId } });
  }

  // Admin
  getAllOrders() {
    return this.prisma.order.findMany();
  }

  createOrder(dto: CreateOrderDto) {
    // return this.prisma.order.create({
    //   data: {
    //     ...dto,
    //     status: 'PENDING',
    //   },
    // });
  }

  getOrderById(id: number) {
    return this.prisma.order.findUnique({ where: { id } });
  }

  updateOrder(id: number, dto: UpdateOrderDto) {
    // return this.prisma.order.update({
    //   where: { id },
    //   data: dto,
    // });
  }

  cancelOrder(id: number, dto: CancelOrderDto) {
    // return this.prisma.order.update({
    //   where: { id },
    //   data: { status: 'CANCELLED', cancelReason: dto.reason },
    // });
  }

  returnOrder(id: number, dto: ReturnOrderDto) {
    // return this.prisma.order.update({
    //   where: { id },
    //   data: { status: 'RETURN_REQUESTED', returnReason: dto.reason },
    // });
  }

  generateInvoice(id: number) {
    return { message: `PDF generated for order ${id}` };
  }

  shipOrder(id: number) {
    return this.prisma.order.update({
      where: { id },
      data: { status: 'SHIPPED' },
    });
  }

  getTracking(id: number) {
    return { tracking: `Tracking info for order ${id}` };
  }

  refundPayment(id: number, dto: RefundDto) {
    // return this.prisma.order.update({
    //   where: { id },
    //   data: { refundAmount: dto.amount, status: 'REFUNDED' },
    // });
  }
}
