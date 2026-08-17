/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  userId: number;
  role: UserRole;
  jti: string;
}

export interface OrderStatusUpdatedPayload {
  orderId: string;
  status: OrderStatus;
  previousStatus: OrderStatus;
  updatedAt: Date;
}

const orderRoom = (orderId: string) => `order:${orderId}`;

/**
 * Customer-facing realtime channel for order tracking — the counterpart to
 * StockEventsGateway's admin-only `/inventory` namespace. Customers connect
 * with a JWT (same handshake shape as the inventory socket) but only
 * CUSTOMER-role tokens are accepted here; a subscription to a specific order
 * is only granted after verifying that order belongs to the connecting user,
 * so one customer can never receive another customer's order events.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/orders',
  cors: { origin: true, credentials: true },
})
export class CustomerOrderEventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(CustomerOrderEventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      this.logger.warn(`Order socket ${client.id} had no auth token`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'secretkey',
      });

      if (payload.role !== UserRole.CUSTOMER) {
        this.logger.warn(
          `Order socket ${client.id} rejected: non-CUSTOMER role`,
        );
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.userId;
    } catch {
      this.logger.warn(`Order socket ${client.id} had an invalid token`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe:order')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orderId?: string },
  ) {
    const orderId = body?.orderId;
    const userId = client.data.userId as number | undefined;

    if (!orderId || !userId) {
      return { ok: false, error: 'forbidden' };
    }

    const order = await this.prisma.order.findFirst({
      where: { orderId, userId },
      select: { id: true },
    });

    if (!order) {
      this.logger.warn(
        `Order socket ${client.id} (user ${userId}) denied subscribe to order "${orderId}"`,
      );
      return { ok: false, error: 'forbidden' };
    }

    await client.join(orderRoom(orderId));
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe:order')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { orderId?: string },
  ) {
    if (body?.orderId) {
      client.leave(orderRoom(body.orderId));
    }
    return { ok: true };
  }

  emitOrderStatusUpdated(orderId: string, payload: OrderStatusUpdatedPayload) {
    this.server.to(orderRoom(orderId)).emit('order:status-updated', payload);
  }
}
