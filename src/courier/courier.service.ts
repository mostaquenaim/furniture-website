/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/courier/courier.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourierStatus } from '@prisma/client';
import { CreateCourierShipmentDto } from './dto/create-courier-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { CourierWebhookDto } from './dto/courier-webhook.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CourierProviderInterface } from './providers/courier-provider.interface';
import { SteadfastCourierProvider } from './providers/steadfast.provider';
import { RedxProvider } from './providers/redx.provider';
import { PaperflyProvider } from './providers/paperfly.provider';
import { PathaoProvider } from './providers/pathao.provider';
import { CalculateRateDto } from './dto/calculate-rate.dto';

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name);
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
      new SteadfastCourierProvider(this.httpService, this.configService),
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

  async createShipment(dto: CreateCourierShipmentDto) {
    return this.prisma.$transaction(async (tx) => {
      // Get order details
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          district: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Check if shipment already exists
      const existingShipment = await tx.courierShipment.findFirst({
        where: {
          orderId: dto.orderId,
          providerId: dto.providerId,
        },
      });

      if (existingShipment) {
        throw new BadRequestException(
          'Shipment already exists for this order with the same provider',
        );
      }

      // Get provider details
      const provider = await tx.courierProvider.findUnique({
        where: { id: dto.providerId },
      });

      if (!provider || !provider.isActive) {
        throw new BadRequestException('Courier provider not available');
      }

      // Get provider implementation
      const providerImpl = this.providers.get(provider.name.toLowerCase());
      if (!providerImpl) {
        throw new BadRequestException(
          `Provider ${provider.name} implementation not found`,
        );
      }

      // Prepare shipment data for provider
      const shipmentData = await this.prepareShipmentData(order, provider);

      // Create shipment with provider
      let providerResponse;
      try {
        providerResponse = await providerImpl.createShipment(shipmentData);
      } catch (error) {
        this.logger.error(
          `Failed to create shipment with ${provider.name}:`,
          error,
        );

        // Create failed shipment record
        await tx.courierShipment.create({
          data: {
            status: 'FAILED',
            errorMessage: error.message,
            metadata: { error: error.response?.data || error.message },
            ...dto,
          },
        });

        throw new BadRequestException(
          `Failed to create shipment: ${error.message}`,
        );
      }

      // Create shipment record
      const shipment = await tx.courierShipment.create({
        data: {
          orderId: dto.orderId,
          providerId: dto.providerId,
          consignmentId: providerResponse.consignmentId,
          trackingNumber: providerResponse.trackingNumber,
          trackingUrl: providerResponse.trackingUrl,
          labelUrl: providerResponse.labelUrl,
          manifestUrl: providerResponse.manifestUrl,
          status: this.mapProviderStatus(providerResponse.status),
          providerStatus: providerResponse.status,
          deliveryCharge: dto.deliveryCharge || providerResponse.deliveryCharge,
          codAmount: dto.codAmount || order.total,
          metadata: providerResponse.metadata,
        },
      });

      // Update order with AWB number if available
      if (providerResponse.consignmentId) {
        await tx.order.update({
          where: { id: dto.orderId },
          data: {
            awbNumber: providerResponse.consignmentId,
          },
        });
      }

      // Create status history entry
      await tx.orderStatusHistory.create({
        data: {
          orderId: dto.orderId,
          status: 'CONFIRMED',
          note: `Shipment created with ${provider.displayName}. AWB: ${providerResponse.consignmentId || providerResponse.trackingNumber}`,
        },
      });

      return shipment;
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

  async getShipmentTracking(orderId: number, providerId?: number) {
    const where: any = { orderId };
    if (providerId) {
      where.providerId = providerId;
    }

    const shipments = await this.prisma.courierShipment.findMany({
      where,
      include: {
        provider: true,
        courierWebhookLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!shipments.length) {
      throw new NotFoundException('No shipments found for this order');
    }

    // Get live tracking for the latest active shipment
    const latestShipment = shipments[0];
    if (
      latestShipment.provider &&
      [
        'PENDING',
        'BOOKED',
        'PICKUP_ASSIGNED',
        'PICKED_UP',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
      ].includes(latestShipment.status)
    ) {
      try {
        const providerImpl = this.providers.get(
          latestShipment.provider.name.toLowerCase(),
        );
        if (providerImpl) {
          const liveTracking = await providerImpl.trackShipment(
            latestShipment.consignmentId || latestShipment.trackingNumber || '',
          );
          return {
            ...latestShipment,
            liveTracking,
          };
        }
      } catch (error) {
        this.logger.error('Failed to fetch live tracking:', error);
      }
    }

    return shipments;
  }

  async handleWebhook(dto: CourierWebhookDto) {
    this.logger.log(`Received webhook from ${dto.provider}: ${dto.eventType}`);

    // Find related shipment
    let shipment;
    if (dto.shipmentId) {
      shipment = await this.prisma.courierShipment.findFirst({
        where: {
          OR: [
            { consignmentId: dto.shipmentId },
            { trackingNumber: dto.shipmentId },
          ],
        },
        include: { provider: true },
      });
    }

    // Log webhook
    const webhookLog = await this.prisma.courierWebhookLog.create({
      data: {
        provider: dto.provider,
        eventType: dto.eventType,
        payload: dto.payload as any,
        shipmentId: shipment?.id,
      },
    });

    // Process webhook based on provider and event type
    try {
      const processed = await this.processWebhook(dto, shipment);

      // Update webhook log as processed
      await this.prisma.courierWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      return processed;
    } catch (error) {
      this.logger.error('Failed to process webhook:', error);

      await this.prisma.courierWebhookLog.update({
        where: { id: webhookLog.id },
        data: {
          error: error.message,
        },
      });

      throw error;
    }
  }

  async calculateRates(dto: CalculateRateDto) {
    const providers = await this.prisma.courierProvider.findMany({
      where: { isActive: true },
      include: {
        rates: {
          where: {
            OR: [
              { districtId: dto.districtId },
              { districtId: null }, // Default rates for all districts
            ],
            weightMin: { lte: dto.weight },
            weightMax: { gte: dto.weight },
            isActive: true,
          },
        },
      },
      orderBy: { priority: 'asc' },
    });

    const rates: any = [];

    for (const provider of providers) {
      // Get applicable rate
      let rate = provider.rates.find((r) => r.districtId === dto.districtId);
      if (!rate) {
        rate = provider.rates.find((r) => r.districtId === null);
      }

      if (rate) {
        // Calculate COD fee if applicable
        let codFee = 0;
        if (dto.codAmount && dto.codAmount > 0) {
          codFee = rate.codFee || 0;
          // If percentage COD fee
          if (typeof codFee === 'number' && codFee < 1) {
            codFee = dto.codAmount * codFee;
          }
        }

        rates.push({
          providerId: provider.id,
          providerName: provider.displayName,
          providerLogo: provider.logo,
          deliveryCharge: rate.price,
          deliveryTime: rate.deliveryTime,
          codFee,
          totalCharge: rate.price + codFee,
        });
      }
    }

    return rates.sort((a, b) => a.totalCharge - b.totalCharge);
  }

  getProviders() {
    return this.prisma.courierProvider.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });
  }

  async syncShipmentStatus(shipmentId: number) {
    const shipment = await this.prisma.courierShipment.findUnique({
      where: { id: shipmentId },
      include: { provider: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const providerImpl = this.providers.get(
      shipment.provider.name.toLowerCase(),
    );
    if (!providerImpl) {
      throw new BadRequestException(
        `Provider ${shipment.provider.name} implementation not found`,
      );
    }

    try {
      const status = await providerImpl.trackShipment(
        shipment.consignmentId || shipment.trackingNumber || '',
      );

      await this.updateShipmentStatus(shipmentId, {
        status: status.status,
        providerStatus: status.providerStatus,
        trackingNumber: status.trackingNumber,
        trackingUrl: status.trackingUrl,
        metadata: status.metadata,
      });

      return { success: true, status };
    } catch (error) {
      this.logger.error(`Failed to sync shipment ${shipmentId}:`, error);
      throw new BadRequestException(`Failed to sync: ${error.message}`);
    }
  }

  private prepareShipmentData(order: any, provider: any) {
    // Prepare data according to provider's requirements
    return {
      orderId: order.orderId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.shippingAddress,
      district: order.district?.name || order.districtName,
      postCode: order.postCode,
      amount: order.total,
      codAmount: order.paymentMethod === 'COD' ? order.total : 0,
      items: order.items.map((item: any) => ({
        name: item.productTitle,
        quantity: item.quantity,
        price: item.priceAtPurchase,
      })),
      weight: this.calculateTotalWeight(order.items),
      ...(provider.config as any),
    };
  }

  private calculateTotalWeight(items: any[]): number {
    // Calculate total weight based on items
    // This should be implemented based on your product weights
    return items.reduce(
      (total, item) => total + (item.product?.weight || 0.5) * item.quantity,
      0,
    );
  }

  private mapProviderStatus(providerStatus: string): CourierStatus {
    const statusMap: Record<string, CourierStatus> = {
      pending: 'PENDING',
      booked: 'BOOKED',
      pickup_assigned: 'PICKUP_ASSIGNED',
      picked_up: 'PICKED_UP',
      in_transit: 'IN_TRANSIT',
      out_for_delivery: 'OUT_FOR_DELIVERY',
      delivered: 'DELIVERED',
      partial_delivered: 'PARTIALLY_DELIVERED',
      returned: 'RETURNED',
      cancelled: 'CANCELLED',
      on_hold: 'ON_HOLD',
      failed: 'FAILED',
    };

    return statusMap[providerStatus.toLowerCase()] || 'PENDING';
  }

  private async processWebhook(dto: CourierWebhookDto, shipment?: any) {
    // Process different event types
    switch (dto.eventType) {
      case 'shipment.created':
      case 'shipment.booked':
        if (shipment) {
          await this.updateShipmentStatus(shipment.id, {
            status: 'BOOKED',
            providerStatus: dto.eventType,
            trackingNumber: dto.payload.tracking_number,
            trackingUrl: dto.payload.tracking_url,
          });
        }
        break;

      case 'shipment.picked_up':
        if (shipment) {
          await this.updateShipmentStatus(shipment.id, {
            status: 'PICKED_UP',
            providerStatus: dto.eventType,
          });
        }
        break;

      case 'shipment.in_transit':
        if (shipment) {
          await this.updateShipmentStatus(shipment.id, {
            status: 'IN_TRANSIT',
            providerStatus: dto.eventType,
          });
        }
        break;

      case 'shipment.out_for_delivery':
        if (shipment) {
          await this.updateShipmentStatus(shipment.id, {
            status: 'OUT_FOR_DELIVERY',
            providerStatus: dto.eventType,
          });
        }
        break;

      case 'shipment.delivered':
        if (shipment) {
          await this.updateShipmentStatus(shipment.id, {
            status: 'DELIVERED',
            providerStatus: dto.eventType,
            metadata: { deliveredAt: dto.payload.delivered_at },
          });
        }
        break;

      case 'shipment.returned':
        if (shipment) {
          await this.updateShipmentStatus(shipment.id, {
            status: 'RETURNED',
            providerStatus: dto.eventType,
          });
        }
        break;

      case 'shipment.failed':
        if (shipment) {
          await this.updateShipmentStatus(shipment.id, {
            status: 'FAILED',
            providerStatus: dto.eventType,
            metadata: { failureReason: dto.payload.reason },
          });
        }
        break;
    }

    return { received: true };
  }
}
