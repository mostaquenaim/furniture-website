/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/courier/courier.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourierStatus, OrderStatus, Prisma } from '@prisma/client';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CourierProviderInterface } from './providers/courier-provider.interface';
import { SteadfastProvider } from './providers/steadfast.provider';
import { RedxProvider } from './providers/redx.provider';
import { PaperflyProvider } from './providers/paperfly.provider';
import { PathaoProvider } from './providers/pathao.provider';
import { COURIER_TO_ORDER_STATUS } from './courier-status.map';

@Injectable()
export class CourierWebhookService {
  private readonly logger = new Logger(CourierWebhookService.name);
  private providers: Map<string, CourierProviderInterface> = new Map();

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.registerProviders();
  }

  private registerProviders() {
    // Register available courier providers
    this.providers.set(
      'steadfast',
      new SteadfastProvider(this.httpService, this.configService),
    );
    this.providers.set(
      'redx',
      new RedxProvider(this.httpService, this.configService),
    );
    this.providers.set(
      'paperfly',
      new PaperflyProvider(this.httpService, this.configService),
    );
    this.providers.set(
      'pathao',
      new PathaoProvider(this.httpService, this.configService),
    );
  }

  // sync order status shipments
  async syncOrderStatusFromShipment(
    shipmentId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    const shipment = await db.courierShipment.findUnique({
      where: { id: shipmentId },
      include: { order: true, provider: true },
    });
    if (!shipment) return;

    const mappedStatus = COURIER_TO_ORDER_STATUS[shipment.status];
    if (!mappedStatus) return;

    // Only move forward — never downgrade order status
    const ORDER_RANK: Record<OrderStatus, number> = {
      PENDING: 0,
      CONFIRMED: 1,
      PROCESSING: 2,
      PACKED: 3,
      SHIPPED: 4,
      DELIVERED: 5,
      CANCELLED: 5,
      FAILED: 5,
      RETURN_REQUESTED: 6,
      RETURNED: 7,
    };

    const currentRank = ORDER_RANK[shipment.order.status] ?? 0;
    const newRank = ORDER_RANK[mappedStatus] ?? 0;

    if (newRank <= currentRank) return;

    await db.order.update({
      where: { id: shipment.orderId },
      data: {
        status: mappedStatus,
        // set AWB when first tracking number arrives
        ...(shipment.trackingNumber && !shipment.order.awbNumber
          ? { awbNumber: shipment.trackingNumber }
          : {}),
      },
    });

    // Write to history log
    await db.orderStatusHistory.create({
      data: {
        orderId: shipment.orderId,
        status: mappedStatus,
        note: `Auto-updated from courier (${shipment.provider?.name ?? 'unknown'}) — ${shipment.status}`,
      },
    });
  }

  async updateShipmentStatus(id: number, dto: UpdateShipmentStatusDto) {
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { id },
      include: {
        provider: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const mappedStatus = this.mapProviderStatus(dto.status);

    // Update shipment
    const updatedShipment = await this.prisma.courierShipment.update({
      where: { id },
      data: {
        status: mappedStatus,
        providerStatus: dto.providerStatus || dto.status,
        trackingNumber: dto.trackingNumber,
        trackingUrl: dto.trackingUrl,
        metadata: dto.metadata,
        ...(mappedStatus === 'DELIVERED' && { deliveredAt: new Date() }),
      },
    });

    // If delivered, update order status
    if (mappedStatus === 'DELIVERED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: {
            status: 'DELIVERED',
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: shipment.orderId,
            status: 'DELIVERED',
            note: 'Order delivered successfully',
          },
        });
      });
    }

    return updatedShipment;
  }

  async handleWebhook(
    provider: string,
    payload: Record<string, any>,
    req?: any,
  ): Promise<{ statusCode: number; message: string }> {
    const providerKey = provider.toUpperCase();
    const eventType = this.extractEventType(provider, payload);

    // Log the webhook immediately
    let logId: number;
    try {
      const log = await this.prisma.courierWebhookLog.create({
        data: {
          provider: providerKey,
          eventType,
          payload: payload as any,
          processed: false,
        },
      });
      logId = log.id;
      this.logger.log(
        `Webhook logged — id=${logId} provider=${providerKey} event="${eventType}"`,
      );
    } catch (logError) {
      this.logger.error('CRITICAL: failed to write webhook log', logError);
      // Still return 202 to prevent courier from retrying
      return { statusCode: 202, message: 'Webhook received' };
    }

    // Handle webhook integration test event
    if (eventType === 'webhook_integration') {
      this.logger.log(`Webhook integration test successful - logId=${logId}`);
      await this.prisma.courierWebhookLog.update({
        where: { id: logId },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });
      return { statusCode: 202, message: 'Webhook integration successful' };
    }

    // Extract consignment ID from payload
    const consignmentId = this.extractConsignmentId(provider, payload);

    if (!consignmentId) {
      this.logger.warn(
        `Webhook logId=${logId}: no consignmentId in payload — skipping`,
      );
      await this.prisma.courierWebhookLog.update({
        where: { id: logId },
        data: { error: 'No consignmentId found in payload' },
      });
      return { statusCode: 202, message: 'Webhook received' };
    }

    // Resolve shipment
    const shipment = await this.prisma.courierShipment.findFirst({
      where: {
        OR: [{ consignmentId }, { trackingNumber: consignmentId }],
      },
      include: { provider: true },
    });

    if (!shipment) {
      this.logger.warn(
        `Webhook logId=${logId}: no shipment for consignmentId="${consignmentId}"`,
      );
      await this.prisma.courierWebhookLog.update({
        where: { id: logId },
        data: {
          error: `No shipment found for consignmentId: ${consignmentId}`,
        },
      });
      return { statusCode: 202, message: 'Webhook received' };
    }

    // Link log to shipment
    await this.prisma.courierWebhookLog.update({
      where: { id: logId },
      data: { shipmentId: shipment.id },
    });

    // Process the webhook
    try {
      await this.processWebhook(provider, payload, shipment);

      await this.prisma.courierWebhookLog.update({
        where: { id: logId },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      this.logger.log(
        `Webhook processed — logId=${logId} shipmentId=${shipment.id} event="${eventType}"`,
      );

      return { statusCode: 202, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(
        `Webhook processing failed — logId=${logId}: ${error.message}`,
        error.stack,
      );
      await this.prisma.courierWebhookLog.update({
        where: { id: logId },
        data: { error: error.message },
      });

      // Always return 202 Accepted to prevent retries
      return { statusCode: 202, message: 'Webhook received' };
    }
  }

  private async processWebhook(
    provider: string,
    payload: Record<string, any>,
    shipment: any,
  ): Promise<void> {
    const providerStatus = this.extractStatus(provider, payload);
    const mappedStatus = this.mapProviderStatus(providerStatus, payload.event);

    this.logger.debug(
      `Processing webhook for shipment ${shipment.id}: ` +
        `event=${payload.event}, providerStatus=${providerStatus}, mappedStatus=${mappedStatus}`,
    );

    // Extract delivery fee if present (Pathao includes it in some events)
    const deliveryFee = payload.delivery_fee;

    // Update shipment with webhook data
    const updateData: any = {
      status: mappedStatus,
      providerStatus,
      lastSyncAt: new Date(),
      metadata: {
        ...((shipment.metadata as Record<string, any>) || {}),
        lastWebhook: {
          event: payload.event,
          timestamp: payload.timestamp || payload.updated_at,
          consignment_id: payload.consignment_id,
          merchant_order_id: payload.merchant_order_id,
          store_id: payload.store_id,
          delivery_fee: payload.delivery_fee,
          raw: payload,
        },
      },
    };

    // Update delivery charge if provided and not already set
    if (
      deliveryFee &&
      (!shipment.deliveryCharge || shipment.deliveryCharge === 0)
    ) {
      updateData.deliveryCharge = deliveryFee;
    }

    // Set deliveredAt if status is DELIVERED
    if (mappedStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }

    await this.prisma.courierShipment.update({
      where: { id: shipment.id },
      data: updateData,
    });

    // Sync order status based on shipment status
    await this.syncOrderStatusFromShipment(shipment.id);
  }

  private extractConsignmentId(provider: string, payload: any): string {
    switch (provider.toLowerCase()) {
      case 'pathao':
        // Pathao sends consignment_id directly in the payload root
        return payload.consignment_id;
      case 'redx':
        return payload.tracking_id || payload.consignment_id;
      case 'steadfast':
        return payload.consignment_id || payload.tracking_code;
      case 'paperfly':
        return payload.trackingNumber || payload.consignmentId;
      default:
        return (
          payload.consignment_id ||
          payload.tracking_number ||
          payload.shipmentId
        );
    }
  }

  private extractEventType(
    provider: string,
    payload: Record<string, any>,
  ): string {
    switch (provider.toLowerCase()) {
      case 'pathao':
        // Pathao sends event in the root (e.g., "order.in-transit", "webhook_integration")
        return payload.event || 'STATUS_UPDATE';
      case 'steadfast':
        return payload?.event ?? payload?.status ?? 'STATUS_UPDATE';
      case 'redx':
        return payload?.event_type ?? payload?.parcel_status ?? 'STATUS_UPDATE';
      case 'paperfly':
        return payload?.event ?? payload?.status ?? 'STATUS_UPDATE';
      default:
        return payload?.event ?? 'STATUS_UPDATE';
    }
  }

  private extractStatus(
    provider: string,
    payload: Record<string, any>,
  ): string {
    switch (provider.toLowerCase()) {
      case 'pathao':
        // For Pathao, the status is derived from the event field
        // e.g., "order.in-transit" -> "in-transit"
        const event = payload.event || '';

        // Handle webhook integration test
        if (event === 'webhook_integration') {
          return 'webhook_integration';
        }

        // Extract the status part after 'order.'
        if (event.startsWith('order.')) {
          return event.substring(6); // Remove 'order.' prefix
        }
        return event || 'unknown';

      case 'steadfast':
        return payload?.status ?? 'unknown';
      case 'redx':
        return payload?.parcel_status ?? payload?.status ?? 'unknown';
      case 'paperfly':
        return payload?.status ?? 'unknown';
      default:
        return payload?.status ?? 'unknown';
    }
  }

  private mapProviderStatus(
    providerStatus: string,
    fullEvent?: string,
  ): CourierStatus {
    // Normalize the status string
    const normalized = providerStatus.toLowerCase().trim();

    // Pathao specific status mapping based on their event names
    const statusMap: Record<string, CourierStatus> = {
      // Webhook integration test
      webhook_integration: 'PENDING',

      // Order events
      created: 'PENDING',
      updated: 'PENDING',

      // Pickup flow
      'pickup-requested': 'PICKUP_ASSIGNED',
      'assigned-for-pickup': 'PICKUP_ASSIGNED',
      picked: 'PICKED_UP',
      'pickup-failed': 'FAILED',
      'pickup-cancelled': 'CANCELLED',

      // Transit flow
      'at-the-sorting-hub': 'IN_TRANSIT',
      'in-transit': 'IN_TRANSIT',
      'received-at-last-mile-hub': 'OUT_FOR_DELIVERY',
      'assigned-for-delivery': 'OUT_FOR_DELIVERY',

      // Delivery flow
      delivered: 'DELIVERED',
      'partial-delivery': 'PARTIALLY_DELIVERED',
      'delivery-failed': 'FAILED',

      // Return flow
      return: 'RETURNED',
      'paid-return': 'RETURNED',

      // Other
      'on-hold': 'ON_HOLD',
      exchange: 'PENDING',
      'payment-invoice': 'PENDING',

      // Store events (not shipment related)
      'store-created': 'PENDING',
      'store-updated': 'PENDING',

      // Keep existing mappings for other providers
      pending: 'PENDING',
      booked: 'BOOKED',
      pickup_assigned: 'PICKUP_ASSIGNED',
      picked_up: 'PICKED_UP',
      in_transit: 'IN_TRANSIT',
      out_for_delivery: 'OUT_FOR_DELIVERY',
      partial_delivered: 'PARTIALLY_DELIVERED',
      returned: 'RETURNED',
      cancelled: 'CANCELLED',
      failed: 'FAILED',
    };

    // Try direct mapping first
    let mapped = statusMap[normalized];

    // If not found and we have full event, try mapping from that
    if (!mapped && fullEvent) {
      const eventKey = fullEvent.toLowerCase().replace(/^order\./, '');
      mapped = statusMap[eventKey];
    }

    return mapped || 'PENDING';
  }
}
