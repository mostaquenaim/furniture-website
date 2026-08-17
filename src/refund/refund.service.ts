/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  Payment,
  Prisma,
  RefundMethod,
  RefundStatus,
  ReturnRequestStatus,
  StockAdjustReason,
} from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import {
  StockEventsGateway,
  StockUpdatedPayload,
} from '../realtime/stock-events.gateway';
import { CustomerOrderEventsGateway } from '../realtime/customer-order-events.gateway';
import { PaymentService } from '../payment/payment.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import {
  ReturnRequestDecision,
  ReviewReturnRequestDto,
} from './dto/review-return-request.dto';
import { ReceiveReturnItemsDto } from './dto/receive-return-items.dto';
import { ProcessRefundDto } from './dto/process-refund.dto';
import { DirectRefundDto } from './dto/direct-refund.dto';
import { CompleteManualRefundDto } from './dto/complete-manual-refund.dto';
import { ReservationService } from '../reservation/reservation.service';

const RETURN_WINDOW_DAYS = 7;
const RETURNABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.PARTIALLY_DELIVERED,
];
// Statuses that still "occupy" a unit against the order item's returnable
// quantity — i.e. everything except a request that never went anywhere.
const ACTIVE_RETURN_STATUSES: ReturnRequestStatus[] = [
  ReturnRequestStatus.PENDING,
  ReturnRequestStatus.APPROVED,
  ReturnRequestStatus.ITEM_RECEIVED,
  ReturnRequestStatus.REFUNDED,
];

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
    private notificationService: NotificationsService,
    private stockLedgerService: StockLedgerService,
    private stockEventsGateway: StockEventsGateway,
    private customerOrderEventsGateway: CustomerOrderEventsGateway,
    private paymentService: PaymentService,
    private reservationService: ReservationService,
  ) {}

  // =====================================================================
  // Return requests
  // =====================================================================

  async createReturnRequest(
    orderIdParam: string,
    dto: CreateReturnRequestDto,
    requesterUserId: number,
    isAdmin: boolean,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ orderId: orderIdParam }, { trackingToken: orderIdParam }],
      },
      include: {
        items: true,
        returnRequests: { include: { items: true } },
        orderStatusHistories: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (!isAdmin && order.userId !== requesterUserId) {
      throw new ForbiddenException('This order does not belong to you');
    }

    if (!RETURNABLE_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        'Only delivered orders are eligible for a return',
      );
    }

    const deliveredHistory = order.orderStatusHistories.find(
      (h) =>
        h.status === OrderStatus.DELIVERED ||
        h.status === OrderStatus.PARTIALLY_DELIVERED,
    );
    const deliveredAt = deliveredHistory?.createdAt ?? order.updatedAt;
    const windowExpiresAt = new Date(
      deliveredAt.getTime() + RETURN_WINDOW_DAYS * 86_400_000,
    );
    if (new Date() > windowExpiresAt) {
      throw new BadRequestException(
        `The ${RETURN_WINDOW_DAYS}-day return window for this order has expired`,
      );
    }

    const blockingStatuses: ReturnRequestStatus[] = [
      ReturnRequestStatus.PENDING,
      ReturnRequestStatus.APPROVED,
      ReturnRequestStatus.ITEM_RECEIVED,
    ];
    const hasActiveRequest = order.returnRequests.some((r) =>
      blockingStatuses.includes(r.status),
    );
    if (hasActiveRequest) {
      throw new BadRequestException(
        'An active return request already exists for this order',
      );
    }

    // Quantity already consumed by a non-rejected/cancelled return request,
    // per order item — prevents returning more units than were purchased
    // across multiple historical requests.
    const consumedQtyByItem = new Map<number, number>();
    for (const req of order.returnRequests) {
      if (!ACTIVE_RETURN_STATUSES.includes(req.status)) continue;
      for (const item of req.items) {
        consumedQtyByItem.set(
          item.orderItemId,
          (consumedQtyByItem.get(item.orderItemId) ?? 0) + item.quantity,
        );
      }
    }

    const orderItemsById = new Map(order.items.map((i) => [i.id, i]));
    for (const reqItem of dto.items) {
      const orderItem = orderItemsById.get(reqItem.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${reqItem.orderItemId} does not belong to this order`,
        );
      }
      const alreadyConsumed = consumedQtyByItem.get(reqItem.orderItemId) ?? 0;
      if (alreadyConsumed + reqItem.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Cannot return ${reqItem.quantity} unit(s) of "${orderItem.productTitle}" — only ${orderItem.quantity - alreadyConsumed} unit(s) remain returnable`,
        );
      }
    }

    const returnRequest = await this.prisma.$transaction(async (tx) => {
      const created = await tx.returnRequest.create({
        data: {
          orderId: order.id,
          requestedBy: order.userId ?? requesterUserId,
          reason: dto.reason,
          note: dto.note,
          previousOrderStatus: order.status,
          items: {
            create: dto.items.map((i) => ({
              orderItemId: i.orderItemId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.RETURN_REQUESTED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.RETURN_REQUESTED,
          note: `Return request #${created.id} filed: ${dto.reason}`,
        },
      });

      return created;
    });

    try {
      await this.notificationService.sendReturnRequestUpdate(
        { email: order.customerEmail, phone: order.customerPhone },
        {
          orderId: order.orderId,
          customerName: order.customerName,
          event: 'SUBMITTED',
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to queue return-request notification for order ${order.orderId}`,
        err,
      );
    }

    return returnRequest;
  }

  async listMyReturnRequests(userId: number, orderId?: string) {
    return this.prisma.returnRequest.findMany({
      where: {
        order: {
          userId,
          ...(orderId ? { orderId } : {}),
        },
      },
      include: {
        items: { include: { orderItem: true } },
        refunds: true,
        order: { select: { orderId: true, status: true, total: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listReturnRequests({
    page = 1,
    limit = 20,
    status,
    search,
  }: {
    page?: number;
    limit?: number;
    status?: ReturnRequestStatus;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: Prisma.ReturnRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            order: {
              OR: [
                { orderId: { contains: search, mode: 'insensitive' } },
                { customerName: { contains: search, mode: 'insensitive' } },
                { customerPhone: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { orderItem: true } },
          refunds: true,
          order: {
            select: {
              orderId: true,
              customerName: true,
              customerPhone: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.returnRequest.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async getReturnRequestOrThrow(id: number) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: { orderItem: { include: { productSize: true } } },
        },
        order: { include: { items: true, payments: true } },
        refunds: true,
      },
    });
    if (!returnRequest) throw new NotFoundException('Return request not found');
    return returnRequest;
  }

  async getReturnRequest(id: number) {
    return this.getReturnRequestOrThrow(id);
  }

  async getReturnRequestForCustomer(id: number, userId: number) {
    const returnRequest = await this.getReturnRequestOrThrow(id);
    if (returnRequest.order.userId !== userId) {
      throw new ForbiddenException(
        'This return request does not belong to you',
      );
    }
    return returnRequest;
  }

  async cancelReturnRequest(id: number, userId: number) {
    const returnRequest = await this.getReturnRequestOrThrow(id);

    if (returnRequest.order.userId !== userId) {
      throw new ForbiddenException(
        'This return request does not belong to you',
      );
    }
    if (returnRequest.status !== ReturnRequestStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending return request can be cancelled',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.returnRequest.update({
        where: { id },
        data: { status: ReturnRequestStatus.CANCELLED },
      });

      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: { status: returnRequest.previousOrderStatus },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: returnRequest.orderId,
          status: returnRequest.previousOrderStatus,
          note: `Return request #${id} cancelled by customer`,
        },
      });

      return result;
    });

    return updated;
  }

  async reviewReturnRequest(
    id: number,
    dto: ReviewReturnRequestDto,
    adminId: number,
  ) {
    const returnRequest = await this.getReturnRequestOrThrow(id);

    if (returnRequest.status !== ReturnRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot review a return request in status ${returnRequest.status}`,
      );
    }

    const approved = dto.decision === ReturnRequestDecision.APPROVED;
    const newStatus = approved
      ? ReturnRequestStatus.APPROVED
      : ReturnRequestStatus.REJECTED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.returnRequest.update({
        where: { id },
        data: {
          status: newStatus,
          adminNote: dto.adminNote,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });

      if (!approved) {
        await tx.order.update({
          where: { id: returnRequest.orderId },
          data: { status: returnRequest.previousOrderStatus },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: returnRequest.orderId,
            status: returnRequest.previousOrderStatus,
            note: `Return request #${id} rejected${dto.adminNote ? `: ${dto.adminNote}` : ''}`,
          },
        });
      } else {
        await tx.orderStatusHistory.create({
          data: {
            orderId: returnRequest.orderId,
            status: OrderStatus.RETURN_REQUESTED,
            note: `Return request #${id} approved — awaiting item receipt`,
          },
        });
      }

      return result;
    });

    this.activityLogService.log({
      adminId,
      action: approved ? 'APPROVE_RETURN_REQUEST' : 'REJECT_RETURN_REQUEST',
      module: 'ORDER',
      targetId: id,
      targetLabel: returnRequest.order.orderId,
      oldValue: { status: ReturnRequestStatus.PENDING },
      newValue: { status: newStatus },
    });

    try {
      await this.notificationService.sendReturnRequestUpdate(
        {
          email: returnRequest.order.customerEmail,
          phone: returnRequest.order.customerPhone,
        },
        {
          orderId: returnRequest.order.orderId,
          customerName: returnRequest.order.customerName,
          event: approved ? 'APPROVED' : 'REJECTED',
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to queue return-review notification for order ${returnRequest.order.orderId}`,
        err,
      );
    }

    return updated;
  }

  async receiveReturnItems(
    id: number,
    dto: ReceiveReturnItemsDto,
    adminId: number,
  ) {
    const returnRequest = await this.getReturnRequestOrThrow(id);

    if (returnRequest.status !== ReturnRequestStatus.APPROVED) {
      throw new BadRequestException(
        'Only an approved return request can be marked as received',
      );
    }

    const stockEvents: StockUpdatedPayload[] = [];
    let orderFullyReturned = false;

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of returnRequest.items) {
        const orderItem = item.orderItem;
        if (!orderItem.productSizeId) {
          this.logger.warn(
            `Return request ${id} item ${item.id} has no productSizeId snapshot — skipping stock restore`,
          );
          continue;
        }
        if (orderItem.productSize?.trackingMode === 'PIECE_BARCODE') {
          // Piece-tracked variant — never restock here. Stock only moves
          // when an Inventory Manager scans the physical piece back in via
          // PieceService.returnReceive (POST /pieces/return/receive), which
          // also correctly branches Good vs Damaged. This bulk endpoint just
          // acknowledges the return request administratively; it does not
          // assert the item has physically arrived.
          this.logger.log(
            `Return request ${id} item ${item.id} is piece-tracked — skipping bulk stock restore, awaiting physical scan`,
          );
          continue;
        }

        const result = await this.stockLedgerService.recordAdjustment(tx, {
          productSizeId: orderItem.productSizeId,
          productId: orderItem.productId,
          delta: item.quantity,
          reason: StockAdjustReason.ORDER_RETURNED,
          adminId,
          note: `Return request #${id} — item(s) received back into stock`,
        });

        await tx.productSize.update({
          where: { id: orderItem.productSizeId },
          data: { soldCount: { decrement: item.quantity } },
        });
        await tx.product.update({
          where: { id: orderItem.productId },
          data: { soldCount: { decrement: item.quantity } },
        });

        stockEvents.push({
          productSizeId: orderItem.productSizeId,
          productId: orderItem.productId,
          quantity: result.quantityAfter,
          lowStockAt: result.lowStockAt,
        });
      }

      const result = await tx.returnRequest.update({
        where: { id },
        data: {
          status: ReturnRequestStatus.ITEM_RECEIVED,
          adminNote: dto.adminNote ?? returnRequest.adminNote,
          receivedBy: adminId,
          receivedAt: new Date(),
        },
      });

      // If every unit of every order item has now been returned (across all
      // of this order's non-rejected/cancelled return requests), the order
      // itself is fully RETURNED — otherwise leave its status untouched and
      // just log the partial receipt.
      const allRequests = await tx.returnRequest.findMany({
        where: {
          orderId: returnRequest.orderId,
          status: {
            in: [
              ReturnRequestStatus.ITEM_RECEIVED,
              ReturnRequestStatus.REFUNDED,
            ],
          },
        },
        include: { items: true },
      });
      const returnedQtyByItem = new Map<number, number>();
      for (const req of allRequests) {
        for (const item of req.items) {
          returnedQtyByItem.set(
            item.orderItemId,
            (returnedQtyByItem.get(item.orderItemId) ?? 0) + item.quantity,
          );
        }
      }
      const isFullyReturned = returnRequest.order.items.every(
        (oi) => (returnedQtyByItem.get(oi.id) ?? 0) >= oi.quantity,
      );

      orderFullyReturned = isFullyReturned;

      if (isFullyReturned) {
        // An admin can mark items received here without every piece-tracked
        // unit having gone through PieceService.returnReceive's physical
        // scan-in first — release any reservation still sitting in
        // RESERVED/PICKED so the order doesn't flip to RETURNED while a
        // physical piece stays permanently locked with no order to fulfill
        // (releaseReservationsForOrder is a no-op for pieces already
        // progressed past PICKED, e.g. SHIPPED/RETURNING/RETURNED_IN_STOCK).
        await this.reservationService.releaseReservationsForOrder(
          tx,
          returnRequest.orderId,
        );

        await tx.order.update({
          where: { id: returnRequest.orderId },
          data: { status: OrderStatus.RETURNED, stockRestored: true },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: returnRequest.orderId,
            status: OrderStatus.RETURNED,
            note: `Return request #${id} — all items received, order fully returned`,
          },
        });
      } else {
        await tx.orderStatusHistory.create({
          data: {
            orderId: returnRequest.orderId,
            status: OrderStatus.RETURN_REQUESTED,
            note: `Return request #${id} — partial item receipt confirmed`,
          },
        });
      }

      return result;
    });

    for (const event of stockEvents) {
      this.stockEventsGateway.emitStockUpdated(event);
    }

    if (orderFullyReturned && returnRequest.order.status !== OrderStatus.RETURNED) {
      try {
        this.customerOrderEventsGateway.emitOrderStatusUpdated(
          returnRequest.order.orderId,
          {
            orderId: returnRequest.order.orderId,
            status: OrderStatus.RETURNED,
            previousStatus: returnRequest.order.status,
            updatedAt: new Date(),
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to emit realtime status update for order ${returnRequest.order.orderId}`,
          err,
        );
      }
    }

    this.activityLogService.log({
      adminId,
      action: 'RECEIVE_RETURN_ITEMS',
      module: 'ORDER',
      targetId: id,
      targetLabel: returnRequest.order.orderId,
      newValue: { status: ReturnRequestStatus.ITEM_RECEIVED },
    });

    try {
      await this.notificationService.sendReturnRequestUpdate(
        {
          email: returnRequest.order.customerEmail,
          phone: returnRequest.order.customerPhone,
        },
        {
          orderId: returnRequest.order.orderId,
          customerName: returnRequest.order.customerName,
          event: 'ITEM_RECEIVED',
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to queue item-received notification for order ${returnRequest.order.orderId}`,
        err,
      );
    }

    return updated;
  }

  // =====================================================================
  // Refunds
  // =====================================================================

  /**
   * Always pass `client` explicitly when called from inside an open
   * transaction (e.g. finalizeRefundCompletion) — querying through
   * `this.prisma` there would run on a separate connection and miss the
   * transaction's own uncommitted writes.
   */
  private async remainingRefundableBalance(
    payment: Payment,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const refunds = await client.paymentRefund.findMany({
      where: {
        paymentId: payment.id,
        status: { in: [RefundStatus.PROCESSING, RefundStatus.COMPLETED] },
      },
    });
    const alreadyRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);
    return Math.max(payment.paidAmount - alreadyRefunded, 0);
  }

  /** Every PAID/PARTIALLY_REFUNDED payment on the order that still has a refundable balance, most recent first. */
  private async findRefundablePayments(
    orderId: number,
  ): Promise<{ payment: Payment; remaining: number }[]> {
    const payments = await this.prisma.payment.findMany({
      where: { orderId, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
      orderBy: { completedAt: 'desc' },
    });

    const results: { payment: Payment; remaining: number }[] = [];
    for (const payment of payments) {
      const remaining = await this.remainingRefundableBalance(payment);
      if (remaining > 0.01) results.push({ payment, remaining });
    }
    return results;
  }

  private async createPendingRefund(params: {
    payment: Payment;
    amount: number;
    reason: string;
    notes?: string;
    returnRequestId?: number;
    requestedBy?: number;
    adminId: number;
  }) {
    const {
      payment,
      amount,
      reason,
      notes,
      returnRequestId,
      requestedBy,
      adminId,
    } = params;

    const refundMethod = this.paymentService.isGatewayRefundable(payment)
      ? RefundMethod.GATEWAY
      : RefundMethod.MANUAL;

    return this.prisma.paymentRefund.create({
      data: {
        paymentId: payment.id,
        returnRequestId,
        amount,
        reason,
        notes,
        refundMethod,
        status: RefundStatus.PENDING,
        requestedBy: requestedBy ?? adminId,
        processedBy: adminId,
      },
    });
  }

  /** Runs the gateway-or-manual refund kickoff for an already-created PENDING refund row. */
  private async kickOffRefund(
    refundId: number,
    payment: Payment,
    remarks: string,
  ) {
    const refund = await this.prisma.paymentRefund.findUniqueOrThrow({
      where: { id: refundId },
    });

    if (refund.refundMethod === RefundMethod.MANUAL) {
      // Manual refunds wait for an admin to confirm the money was actually
      // sent — see completeManualRefund.
      return this.prisma.paymentRefund.update({
        where: { id: refundId },
        data: { status: RefundStatus.PROCESSING },
      });
    }

    try {
      const result = await this.paymentService.initiateGatewayRefund(
        payment,
        refund.amount,
        remarks,
      );

      const status = result.status.includes('fail')
        ? RefundStatus.FAILED
        : RefundStatus.PROCESSING;

      return this.prisma.paymentRefund.update({
        where: { id: refundId },
        data: {
          status,
          gatewayRefundId: result.refundRefId,
          gatewayResponse: result.raw,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Gateway refund failed for refund #${refundId}`, err);
      await this.prisma.paymentRefund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.FAILED,
          notes: `${refund.notes ? refund.notes + ' | ' : ''}Gateway error: ${err.message}`,
        },
      });
      throw new BadRequestException(
        `Gateway refund failed: ${err.message ?? 'unknown error'}`,
      );
    }
  }

  /** Marks a refund COMPLETED and propagates the payment/order/return-request state. */
  private async finalizeRefundCompletion(refundId: number) {
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.update({
        where: { id: refundId },
        data: { status: RefundStatus.COMPLETED, processedAt: new Date() },
        include: { payment: true },
      });

      // Computed against `tx` so this refund's own just-applied COMPLETED
      // status is already reflected in the sum.
      const remaining = await this.remainingRefundableBalance(
        refund.payment,
        tx,
      );
      const paymentStatus =
        remaining <= 0.01 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      await tx.payment.update({
        where: { id: refund.paymentId },
        data: { status: paymentStatus, refundedAt: new Date() },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id: refund.payment.orderId },
        include: { payments: true },
      });
      const allOtherPaymentsSettled = order.payments
        .filter((p) => p.id !== refund.paymentId)
        .every((p) =>
          (['REFUNDED', 'CANCELLED', 'FAILED'] as string[]).includes(p.status),
        );

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus:
            paymentStatus === 'REFUNDED' && allOtherPaymentsSettled
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED',
        },
      });

      if (refund.returnRequestId) {
        await tx.returnRequest.update({
          where: { id: refund.returnRequestId },
          data: { status: ReturnRequestStatus.REFUNDED },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: order.status,
          note: `Refund of ${refund.amount} completed for payment ${refund.payment.transactionId}`,
        },
      });

      return tx.paymentRefund.findUniqueOrThrow({ where: { id: refundId } });
    });
  }

  async processReturnRefund(
    returnRequestId: number,
    dto: ProcessRefundDto,
    adminId: number,
  ) {
    const returnRequest = await this.getReturnRequestOrThrow(returnRequestId);

    if (returnRequest.status !== ReturnRequestStatus.ITEM_RECEIVED) {
      throw new BadRequestException(
        'A refund can only be processed once the returned item(s) have been received',
      );
    }
    if (returnRequest.refunds.some((r) => r.status !== RefundStatus.FAILED)) {
      throw new BadRequestException(
        'A refund has already been processed for this return request',
      );
    }

    const orderItemsById = new Map(
      returnRequest.order.items.map((i) => [i.id, i]),
    );
    const itemValue = returnRequest.items.reduce((sum, item) => {
      const orderItem = orderItemsById.get(item.orderItemId);
      return sum + (orderItem?.priceAtPurchase ?? 0) * item.quantity;
    }, 0);

    const refundable = await this.findRefundablePayments(returnRequest.orderId);
    const best = refundable[0];
    if (!best) {
      throw new BadRequestException(
        'No payment with a refundable balance was found for this order',
      );
    }

    // Item prices are pre-discount snapshots, so the order-level coupon/
    // discount can make their sum exceed what was actually paid — refunding
    // can never exceed the payment's real remaining balance.
    const amount = dto.amount ?? Math.min(itemValue, best.remaining);
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    if (amount > best.remaining + 0.01) {
      throw new BadRequestException(
        `Refund amount must not exceed the refundable balance of ${best.remaining}`,
      );
    }

    const payment = best.payment;

    const refund = await this.createPendingRefund({
      payment,
      amount,
      reason: returnRequest.reason,
      notes: dto.notes,
      returnRequestId,
      requestedBy: returnRequest.requestedBy ?? undefined,
      adminId,
    });

    const kicked = await this.kickOffRefund(
      refund.id,
      payment,
      dto.notes ?? `Return #${returnRequestId}`,
    );

    this.activityLogService.log({
      adminId,
      action: 'PROCESS_RETURN_REFUND',
      module: 'ORDER',
      targetId: refund.id,
      targetLabel: returnRequest.order.orderId,
      newValue: { amount, status: kicked.status },
    });

    return kicked;
  }

  async processDirectRefund(
    orderIdParam: string,
    dto: DirectRefundDto,
    adminId: number,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderId: orderIdParam },
    });
    if (!order) throw new NotFoundException('Order not found');

    const directRefundEligibleStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.FAILED,
    ];
    if (!directRefundEligibleStatuses.includes(order.status)) {
      throw new BadRequestException(
        'A direct refund (without a return request) is only available for cancelled or failed orders',
      );
    }

    const refundable = await this.findRefundablePayments(order.id);
    const best = refundable[0];
    if (!best) {
      throw new BadRequestException(
        'This order has no payment with a refundable balance',
      );
    }

    const amount = dto.amount ?? best.remaining;
    if (amount <= 0 || amount > best.remaining + 0.01) {
      throw new BadRequestException(
        `Refund amount must be between 0 and the refundable balance of ${best.remaining}`,
      );
    }

    const refund = await this.createPendingRefund({
      payment: best.payment,
      amount,
      reason: dto.reason,
      notes: dto.notes,
      adminId,
    });

    const kicked = await this.kickOffRefund(
      refund.id,
      best.payment,
      dto.notes ?? `Order ${order.orderId} cancelled`,
    );

    this.activityLogService.log({
      adminId,
      action: 'PROCESS_DIRECT_REFUND',
      module: 'ORDER',
      targetId: refund.id,
      targetLabel: order.orderId,
      newValue: { amount, status: kicked.status },
    });

    return kicked;
  }

  async completeManualRefund(
    refundId: number,
    dto: CompleteManualRefundDto,
    adminId: number,
  ) {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id: refundId },
      include: { payment: { include: { order: true } } },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (refund.refundMethod !== RefundMethod.MANUAL) {
      throw new BadRequestException(
        'Only manually-processed refunds can be completed this way — use the gateway sync for online refunds',
      );
    }
    if (refund.status === RefundStatus.COMPLETED) {
      throw new BadRequestException('This refund has already been completed');
    }

    await this.prisma.paymentRefund.update({
      where: { id: refundId },
      data: {
        gatewayRefundId: dto.reference ?? refund.gatewayRefundId,
        notes: dto.notes ?? refund.notes,
        processedBy: adminId,
      },
    });

    const completed = await this.finalizeRefundCompletion(refundId);

    this.activityLogService.log({
      adminId,
      action: 'COMPLETE_MANUAL_REFUND',
      module: 'ORDER',
      targetId: refundId,
      targetLabel: refund.payment.order.orderId,
      newValue: { status: RefundStatus.COMPLETED },
    });

    try {
      await this.notificationService.sendRefundUpdate(
        {
          email: refund.payment.order.customerEmail,
          phone: refund.payment.order.customerPhone,
        },
        {
          orderId: refund.payment.order.orderId,
          customerName: refund.payment.order.customerName,
          amount: refund.amount,
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to queue refund-completed notification for order ${refund.payment.order.orderId}`,
        err,
      );
    }

    return completed;
  }

  async syncGatewayRefund(refundId: number, adminId: number) {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id: refundId },
      include: { payment: { include: { order: true } } },
    });
    if (!refund) throw new NotFoundException('Refund not found');

    if (
      refund.refundMethod !== RefundMethod.GATEWAY ||
      !refund.gatewayRefundId
    ) {
      throw new BadRequestException(
        'This refund has no gateway reference to sync against',
      );
    }
    if (refund.status === RefundStatus.COMPLETED) {
      return refund;
    }

    const raw = await this.paymentService.queryGatewayRefundStatus(
      refund.gatewayRefundId,
    );
    const status = String(raw?.status ?? '').toLowerCase();

    await this.prisma.paymentRefund.update({
      where: { id: refundId },
      data: { gatewayResponse: raw },
    });

    this.activityLogService.log({
      adminId,
      action: 'SYNC_GATEWAY_REFUND',
      module: 'ORDER',
      targetId: refundId,
      targetLabel: refund.payment.order.orderId,
      newValue: { gatewayStatus: status },
    });

    if (status.includes('fail')) {
      return this.prisma.paymentRefund.update({
        where: { id: refundId },
        data: { status: RefundStatus.FAILED },
      });
    }
    if (status.includes('complet') || status.includes('success')) {
      const completed = await this.finalizeRefundCompletion(refundId);
      try {
        await this.notificationService.sendRefundUpdate(
          {
            email: refund.payment.order.customerEmail,
            phone: refund.payment.order.customerPhone,
          },
          {
            orderId: refund.payment.order.orderId,
            customerName: refund.payment.order.customerName,
            amount: refund.amount,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to queue refund-completed notification for order ${refund.payment.order.orderId}`,
          err,
        );
      }
      return completed;
    }

    return this.prisma.paymentRefund.findUniqueOrThrow({
      where: { id: refundId },
    });
  }

  async listRefunds({
    page = 1,
    limit = 20,
    status,
    search,
  }: {
    page?: number;
    limit?: number;
    status?: RefundStatus;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentRefundWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            payment: {
              OR: [
                { transactionId: { contains: search, mode: 'insensitive' } },
                {
                  order: { orderId: { contains: search, mode: 'insensitive' } },
                },
                {
                  order: {
                    customerName: { contains: search, mode: 'insensitive' },
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.paymentRefund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          payment: {
            select: {
              id: true,
              transactionId: true,
              method: true,
              orderId: true,
              order: { select: { orderId: true, customerName: true } },
            },
          },
        },
      }),
      this.prisma.paymentRefund.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getRefund(id: number) {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id },
      include: {
        payment: { include: { order: true } },
        returnRequest: { include: { items: { include: { orderItem: true } } } },
      },
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }
}
