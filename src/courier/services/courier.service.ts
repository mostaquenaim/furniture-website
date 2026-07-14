/* eslint-disable no-case-declarations */
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
import { PrismaService } from '../../prisma/prisma.service';
import { CourierStatus, OrderStatus, Prisma } from '@prisma/client';
import { CreateCourierShipmentDto } from '../dto/create-courier-shipment.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CourierProviderInterface } from '../providers/courier-provider.interface';
import { SteadfastProvider } from '../providers/steadfast.provider';
import { RedxProvider } from '../providers/redx.provider';
import { PaperflyProvider } from '../providers/paperfly.provider';
import { PathaoProvider } from '../providers/pathao.provider';
import { CalculateRateDto } from '../dto/calculate-rate.dto';
import { CreateCourierProviderDto } from '../dto/create-courier-provider.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { UpdateCourierProviderDto } from '../dto/update-courier-provider.dto';
import { COURIER_TO_ORDER_STATUS } from '../courier-status.map';
import { ReservationService } from 'src/reservation/reservation.service';

@Injectable()
export class CourierService {
  private readonly logger = new Logger(CourierService.name);
  private providers: Map<string, CourierProviderInterface> = new Map();

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
    private httpService: HttpService,
    private configService: ConfigService,
    private reservationService: ReservationService,
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

  getProviders() {
    return this.prisma.courierProvider.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });
  }

  // courier providers
  async addProvider(dto: CreateCourierProviderDto, adminId: number) {
    const created = await this.prisma.courierProvider.create({
      data: {
        name: dto.name.toLowerCase(),
        displayName: dto.displayName,
        isActive: dto.isActive ?? true,
        config: dto.config ?? {},
      },
    });

    await this.activityLogService.log({
      adminId,
      action: 'CREATE_COURIER-PROVIDER',
      module: 'SYSTEM',
      targetId: created.id,
      targetLabel: `${created.name}`,
      newValue: {
        name: created.name,
        displayName: created.displayName,
      },
    });

    return created;
  }

  async updateProvider(
    id: number,
    dto: UpdateCourierProviderDto,
    adminId: number,
  ) {
    const existing = await this.prisma.courierProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Courier provider not found');
    }

    const updated = await this.prisma.courierProvider.update({
      where: { id },
      data: {
        name: dto.name?.toLowerCase(),
        displayName: dto.displayName,
        isActive: dto.isActive,
        config: dto.config,
      },
    });

    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_COURIER-PROVIDER',
      module: 'SYSTEM',
      targetId: updated.id,
      targetLabel: updated.name,
      oldValue: {
        name: existing.name,
        displayName: existing.displayName,
        isActive: existing.isActive,
      },
      newValue: {
        name: updated.name,
        displayName: updated.displayName,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async deleteProvider(id: number, adminId: number) {
    const existing = await this.prisma.courierProvider.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Courier provider not found');
    }

    await this.prisma.courierProvider.delete({
      where: { id },
    });

    await this.activityLogService.log({
      adminId,
      action: 'DELETE_COURIER-PROVIDER',
      module: 'SYSTEM',
      targetId: existing.id,
      targetLabel: existing.name,
      oldValue: {
        name: existing.name,
        displayName: existing.displayName,
      },
    });

    return { message: 'Provider deleted successfully' };
  }

  private prepareShipmentData(
    orderData: any,
    provider: any,
    specialInstructions?: string,
  ) {
    // Get merchant store ID from provider config
    const storeId =
      provider.config?.store_id || provider.config?.merchant_store_id;

    if (!storeId) {
      throw new Error('store_id not configured for Pathao provider');
    }

    // Calculate total items quantity
    const totalQuantity = orderData.items.reduce(
      (sum: number, item: any) => sum + (item.quantity || 1),
      0,
    );

    // Calculate total weight (default to 0.5 if not available)
    const weight = this.calculateTotalWeight(orderData.items) || 0.5;

    // Create item description from order items
    const itemDescription = orderData.items
      .map((item: any) => `${item.quantity}x ${item.productTitle}`)
      .join(', ');

    // Base data for all providers
    const baseData = {
      orderId: orderData.orderId || orderData.id,
      customerName: orderData.customerName || orderData.shippingName,
      customerPhone: this.normalizeBDPhone(
        orderData.customerPhone || orderData.phone,
      ),
      shippingAddress: orderData.shippingAddress || orderData.address,
      district: orderData.district?.name || orderData.districtName,
      postCode: orderData.postCode,
      amount: orderData.total,
      codAmount: orderData.paymentMethod === 'COD' ? orderData.total : 0,
      totalQuantity,
      weight: weight.toString(), // Convert to string for Pathao
      itemDescription: itemDescription.substring(0, 500), // Limit length
    };

    // Provider-specific data transformation
    switch (provider.name.toLowerCase()) {
      case 'pathao':
        return {
          ...baseData,
          store_id: storeId,
          merchant_store_id: storeId,
          recipient_name: baseData.customerName,
          recipient_phone: baseData.customerPhone,
          recipient_address: baseData.shippingAddress,
          delivery_type: 48, // Standard delivery
          item_type: 2, // Document/Parcel
          special_instruction: specialInstructions || '',
          item_quantity: baseData.totalQuantity,
          item_weight: baseData.weight,
          item_description: baseData.itemDescription,
          amount_to_collect: baseData.codAmount,
        };

      case 'redx':
        // RedX specific transformation
        return {
          ...baseData,
          // RedX specific fields
        };

      default:
        return baseData;
    }
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
      ON_HOLD: 2,
      PARTIALLY_DELIVERED: 5,
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

  async createShipment(dto: CreateCourierShipmentDto, adminId: number) {
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

      // Hard gate: if this order has piece-tracked line items, every
      // reserved piece must be scan-confirmed as Picked before a courier
      // shipment (and its delivery label) can be created. Orders with no
      // piece-tracked lines aren't affected — see checkFullyPickedForOrder.
      const pickGate = await this.reservationService.checkFullyPickedForOrder(
        order.id,
        tx,
      );
      if (!pickGate.isFullyPicked) {
        throw new BadRequestException(
          `Cannot create shipment — only ${pickGate.pickedCount}/${pickGate.requiredCount} piece(s) have been picked for this order`,
        );
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
      const shipmentData = this.prepareShipmentData(
        order,
        provider,
        dto.special_instruction,
      );

      // console.log('shipmentData', shipmentData.store_id);
      // Create shipment with provider
      let providerResponse;
      try {
        providerResponse = await providerImpl.createShipment(shipmentData);
      } catch (error) {
        this.logger.error(
          `Failed to create shipment with ${provider.name}:`,
          error,
        );

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
          trackingNumber:
            providerResponse.trackingNumber || providerResponse.consignmentId,
          trackingUrl: providerResponse.trackingUrl,
          status: this.mapProviderStatus(providerResponse.status),
          providerStatus: providerResponse.status,
          deliveryCharge:
            dto.deliveryCharge || providerResponse.deliveryFee || 0,
          codAmount: dto.codAmount || order.total,
          metadata: providerResponse.metadata,
        },
      });

      await this.syncOrderStatusFromShipment(shipment.id, tx);

      // Move this order's reserved/picked pieces to SHIPPED now that a real
      // shipment + label exist. No-op for orders with no piece-tracked lines.
      await this.reservationService.markShipmentGroupShipped(
        tx,
        order.id,
        shipment.id,
      );

      await this.activityLogService.log({
        adminId,
        action: 'CREATE_SHIPMENT',
        module: 'ORDER',
        targetId: shipment.id,
        targetLabel: `Order no. ${shipment.orderId}`,
        newValue: {
          orderId: shipment.orderId,
          providerId: shipment.providerId,
          consignmentId: shipment.consignmentId,
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
          providerStatus: shipment.providerStatus,
          deliveryCharge: shipment.deliveryCharge,
          codAmount: shipment.codAmount,
          metadata: shipment.metadata,
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

  // get shipments
  async getShipments({
    page = 1,
    limit = 10,
    provider,
    status,
    search,
  }: {
    page?: number;
    limit?: number;
    provider?: string;
    status?: string;
    search?: string;
  }) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (provider) {
      where.provider = provider;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { orderId: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { recipientPhone: { contains: search } },
      ];
    }

    const [shipments, total] = await this.prisma.$transaction([
      this.prisma.courierShipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          order: true,
          provider: true,
        },
      }),

      this.prisma.courierShipment.count({ where }),
    ]);

    return {
      data: shipments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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

  private calculateTotalWeight(items: any[]): number {
    if (!items || items.length === 0) {
      return 0.5; // Default weight
    }

    const totalWeight = items.reduce((sum, item) => {
      const itemWeight = item.product?.weight || item.weight || 0;
      const quantity = item.quantity || 1;
      return sum + itemWeight * quantity;
    }, 0);

    // Minimum weight check (Pathao requires at least 0.5 kg)
    return Math.max(totalWeight, 0.5);
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

  private mapProviderStatus(providerStatus: string): CourierStatus {
    // Normalize the status string
    const normalized = providerStatus.toLowerCase().trim();

    const statusMap: Record<string, CourierStatus> = {
      // Pathao specific statuses
      pending: 'PENDING',
      pickup_requested: 'PICKUP_ASSIGNED',
      assigned_for_pickup: 'PICKUP_ASSIGNED',
      pickup: 'PICKED_UP',
      pickup_failed: 'FAILED',
      pickup_cancelled: 'CANCELLED',
      at_the_sorting_hub: 'IN_TRANSIT',
      in_transit: 'IN_TRANSIT',
      'in-transit': 'IN_TRANSIT', // Handle hyphenated version
      received_at_last_mile_hub: 'OUT_FOR_DELIVERY',
      assigned_for_delivery: 'OUT_FOR_DELIVERY',
      delivered: 'DELIVERED',
      partial_delivery: 'PARTIALLY_DELIVERED',
      return: 'RETURNED',
      delivery_failed: 'FAILED',
      on_hold: 'ON_HOLD',
      cancelled: 'CANCELLED',

      // Keep existing mappings for other providers
      booked: 'BOOKED',
      pickup_assigned: 'PICKUP_ASSIGNED',
      picked_up: 'PICKED_UP',
      out_for_delivery: 'OUT_FOR_DELIVERY',
      partial_delivered: 'PARTIALLY_DELIVERED',
      returned: 'RETURNED',
      failed: 'FAILED',
    };

    return statusMap[normalized] || 'PENDING';
  }

  private normalizeBDPhone(phone: string): string {
    if (!phone) return phone;

    // remove spaces and dashes
    phone = phone.replace(/[\s-]/g, '');

    if (phone.startsWith('+880')) {
      return '0' + phone.slice(4);
    }

    if (phone.startsWith('880')) {
      return '0' + phone.slice(3);
    }

    return phone;
  }

  // get zones, areas
  async getZones(cityId: number) {
    const provider = await this.prisma.courierProvider.findUnique({
      where: { name: 'pathao' },
    });

    if (!provider || !provider.isActive) {
      throw new BadRequestException('Courier provider not available');
    }

    const providerImpl = this.providers.get(provider.name.toLowerCase());

    if (!providerImpl) {
      throw new BadRequestException(
        `Provider ${provider.name} implementation not found`,
      );
    }

    let response;
    try {
      response = await providerImpl.getZones(cityId);
    } catch (error) {
      this.logger.error(`Failed to fetch zones from ${provider.name}`, error);
      throw new BadRequestException('Failed to fetch zones');
    }

    return response.map((zone: any) => ({
      id: zone.zone_id,
      name: zone.zone_name,
      cityId: zone.city_id,
    }));
  }

  async getAreas(zoneId: number) {
    const provider = await this.prisma.courierProvider.findUnique({
      where: { name: 'pathao' },
    });

    if (!provider || !provider.isActive) {
      throw new BadRequestException('Courier provider not available');
    }

    const providerImpl = this.providers.get(provider.name.toLowerCase());

    if (!providerImpl) {
      throw new BadRequestException(
        `Provider ${provider.name} implementation not found`,
      );
    }

    let response;
    try {
      response = await providerImpl.getAreas(zoneId);
    } catch (error) {
      this.logger.error(`Failed to fetch areas from ${provider.name}`, error);
      throw new BadRequestException('Failed to fetch areas');
    }

    return response.map((area: any) => ({
      id: area.area_id,
      name: area.area_name,
      zoneId: area.zone_id,
    }));
  }

  async calculateDeliveryFee(data: {
    cityId: number;
    zoneId: number;
    weight: number;
  }) {
    const provider: any = await this.prisma.courierProvider.findUnique({
      where: { name: 'pathao' },
    });

    if (!provider || !provider.isActive) {
      throw new BadRequestException('Courier provider not available');
    }

    const providerImpl = this.providers.get(provider.name.toLowerCase());

    if (!providerImpl) {
      throw new BadRequestException(
        `Provider ${provider.name} implementation not found`,
      );
    }

    const storeId =
      provider.config?.store_id || provider.config?.merchant_store_id;

    if (!storeId) {
      throw new Error('store_id not configured for Pathao provider');
    }

    try {
      const response = await providerImpl.calculateRate({
        store_id: storeId,
        item_type: 2,
        delivery_type: 48,
        item_weight: data.weight,
        recipient_city: data.cityId,
        recipient_zone: data.zoneId,
      });

      const fee = response?.totalCharge || 0;

      const extraCharge = provider.config?.extra_charge || 20;

      return {
        fee: fee + extraCharge,
        codAvailable: response.codEnabled,
        codPercentage: response.codFee,
      };
    } catch (error) {
      this.logger.error('Pathao rate failed', error);

      return {
        fee: 80,
      };
    }
  }
}
