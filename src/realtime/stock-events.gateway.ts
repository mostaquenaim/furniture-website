/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserRole } from '@prisma/client';

interface JwtPayload {
  userId: number;
  role: UserRole;
  jti: string;
}

export interface StockUpdatedPayload {
  productSizeId: number;
  productId: number;
  quantity: number;
  lowStockAt: number;
}

export interface ReturnStartedPayload {
  orderId: string;
  pieceCount: number;
  reasonCode?: string | null;
}

/**
 * Admin-only realtime channel for the inventory dashboard. Staff connect with a JWT
 * in the socket.io handshake `auth.token` field (same token issued by AuthService.issueToken).
 * Trust model mirrors JwtStrategy exactly: verify signature + read the role claim
 * directly off the payload, no DB lookup. CUSTOMER tokens (and anything invalid/missing)
 * are disconnected immediately — this socket is not meant for storefront clients.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/inventory',
  cors: { origin: true, credentials: true },
})
export class StockEventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(StockEventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      this.logger.warn(`Inventory socket ${client.id} had no auth token`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || 'secretkey',
      });

      if (payload.role === UserRole.CUSTOMER) {
        this.logger.warn(
          `Inventory socket ${client.id} rejected: CUSTOMER role`,
        );
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.userId;
      client.data.role = payload.role;
    } catch {
      this.logger.warn(`Inventory socket ${client.id} had an invalid token`);
      client.disconnect(true);
    }
  }

  emitStockUpdated(payload: StockUpdatedPayload) {
    this.server.emit('stock:updated', payload);

    if (payload.quantity <= payload.lowStockAt) {
      this.server.emit('stock:low', payload);
    }
  }

  emitReturnStarted(payload: ReturnStartedPayload) {
    this.server.emit('return:started', payload);
  }
}
