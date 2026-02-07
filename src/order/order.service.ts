/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  private async generateOrderId(tx: Prisma.TransactionClient) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const countToday = await tx.order.count({
      where: {
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });

    const sequence = String(countToday + 1).padStart(6, '0');

    return `ORD-${dateStr}-${sequence}`;
  }

  // create a order
  async createOrder(userId: number, dto: CreateOrderDto) {
    console.log(userId, 'userId');
    // 1. Validate district (especially for COD)
    const district = await this.prisma.district.findUnique({
      where: { id: dto.address.districtId },
    });

    if (!district) {
      throw new BadRequestException('Invalid district selected');
    }

    // COD check
    if (dto.paymentMethod === 'COD' && !district.isCODAvailable) {
      throw new BadRequestException(
        'Cash on Delivery is not available for this district',
      );
    }

    // 2. Fetch user's cart items
    const cart = await this.prisma.cart.findUnique({
      where: { id: dto.cartId },
      include: {
        items: {
          include: {
            productSize: { include: { color: { include: { product: true } } } },
          },
        },
        coupon: true,
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    if (cart.userId !== userId || cart.status !== 'ACTIVE') {
      throw new ForbiddenException('Invalid cart');
    }

    // 2a. Check for price changes
    const priceChangedItems: string[] = [];
    for (const item of cart.items) {
      const productPrice = item?.productSize?.color?.product?.price ?? 0;
      if (productPrice > Number(item.priceAtAdd)) {
        // Update cart subtotalAtAdd for this item
        await this.prisma.cartItem.update({
          where: { id: item.id },
          data: {
            priceAtAdd: productPrice,
            subtotalAtAdd: productPrice * item.quantity,
          },
        });

        priceChangedItems.push(item?.productSize?.color?.product?.title);
      }
    }

    if (priceChangedItems.length > 0) {
      throw new BadRequestException(
        `The price of the following product(s) has increased: ${priceChangedItems.join(
          ', ',
        )}. Your cart has been updated with the new price.`,
      );
    }

    // 3. Calculate totals
    let subtotal = 0;
    for (const item of cart.items) {
      subtotal += Number(item.subtotalAtAdd);
    }

    let customerPhone = dto.address.phone;

    // Ensure it starts with '+880'
    if (!customerPhone.startsWith('+880')) {
      if (customerPhone.startsWith('0')) {
        customerPhone = '+880' + customerPhone.slice(1);
      } else if (customerPhone.startsWith('1')) {
        customerPhone = '+880' + customerPhone;
      }
    }

    const deliveryCharge =
      district.deliveryFee ?? Number(process.env.DEFAULT_DELIVERY_FEE) ?? 120;
    const total = subtotal + deliveryCharge;

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
        const updated = await tx.productSize.updateMany({
          where: {
            id: item.productSizeId,
            quantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
            soldCount: { increment: item.quantity },
          },
        });

        if (updated.count === 0) {
          throw new BadRequestException(
            `Insufficient stock for ${item.productSize.color.product.title}`,
          );
        }

        await tx.product.update({
          where: { id: item.productSize.color.productId },
          data: {
            soldCount: { increment: item.quantity },
          },
        });
      }

      const orderId = await this.generateOrderId(tx);
      const trackingToken = nanoid(10); // generate 10-char token

      // 4. Create order
      const order = await tx.order.create({
        data: {
          userId,
          orderId,
          trackingToken,
          customerName: dto.address.name,
          customerPhone: customerPhone,
          shippingAddress: dto.address.fullAddress,
          districtId: dto.address.districtId,
          districtName: district.name,
          deliveryMethod: dto.paymentMethod === 'COD' ? 'COD' : 'ONLINE',
          couponCode: cart?.coupon?.code,
          total,
          items: {
            create: cart.items.map((item) => ({
              productId: item?.productSize?.color?.productId,
              productTitle: item?.productSize?.color?.product?.title,
              sku: item?.productSize?.sku,
              color: item?.color,
              size: item?.size,
              quantity: item?.quantity,
              priceAtPurchase: item?.productSize?.color?.product?.price ?? 0,
              basePriceAtPurchase:
                item?.productSize?.color?.product?.basePrice ?? 0,
              totalPriceAtPurchase:
                (item?.productSize?.color?.product?.price ?? 0) *
                item?.quantity,
            })),
          },
        },
      });

      // 5. Optionally clear cart
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CHECKED_OUT' },
      });

      return order;
    });

    return order;
  }

  // get all orders
  async getAllOrders(
    userId: number,
    {
      page = 1,
      limit = 5,
      search,
      status,
      orderBy,
      thumb,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      status?: OrderStatus;
      orderBy?: Record<string, 'asc' | 'desc'>;
      thumb?: boolean;
    },
  ) {
    const skip = (page - 1) * limit;

    const where: any = { userId };

    // Search logic
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { awbNumber: { contains: search, mode: 'insensitive' } },
      ];

      if (!isNaN(Number(search))) {
        where.OR.push({ id: Number(search) });
      }
    }

    if (status) {
      where.status = status;
    }

    let data: any[];
    let total: number;

    const statusGroups = await this.prisma.order.groupBy({
      by: ['status'],
      where: { userId }, // IMPORTANT: no pagination filters
      _count: { _all: true },
    });

    const statusCounts: Record<OrderStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      PACKED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURNED: 0,
    };

    statusGroups.forEach((g) => {
      statusCounts[g.status] = g._count._all;
    });

    if (thumb) {
      const [dataRaw, totalRaw] = await this.prisma.$transaction([
        this.prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: orderBy ?? { createdAt: 'desc' },
          select: {
            id: true,
            orderId: true,
            createdAt: true,
            status: true,
            total: true,
            items: { select: { quantity: true } },
          },
        }),
        this.prisma.order.count({ where }),
      ]);

      data = dataRaw.map((order) => ({
        id: order.id,
        orderId: order.orderId,
        createdAt: order.createdAt,
        status: order.status,
        total: order.total,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      }));

      total = totalRaw;
    } else {
      // Full order with items & payments
      [data, total] = await this.prisma.$transaction([
        this.prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: orderBy ?? { createdAt: 'desc' },
          include: {
            items: {
              include: { product: { select: { id: true, slug: true } } },
            },
            payments: { orderBy: { createdAt: 'desc' } },
          },
        }),
        this.prisma.order.count({ where }),
      ]);
    }

    return {
      data,
      statusCounts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async trackOrder(userId: number, orderId: string) {
    // Find the order with all related data
    const order = await this.prisma.order.findFirst({
      where: {
        userId: userId,
        OR: [{ orderId: orderId }, { trackingToken: orderId }],
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                  orderBy: {
                    serialNo: 'asc',
                  },
                },
              },
            },
          },
        },
        orderStatusHistories: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        district: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Map OrderStatus enum to user-friendly tracking events
    const statusMapping = {
      PENDING: 'Order Placed',
      CONFIRMED: 'Order Confirmed',
      PACKED: 'Packed',
      SHIPPED: 'Shipped',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      RETURNED: 'Returned',
    };

    // Define the expected flow of statuses
    const expectedFlow = [
      'PENDING',
      'CONFIRMED',
      'PACKED',
      'SHIPPED',
      'DELIVERED',
    ];

    // Get all status changes from history
    const completedStatuses = new Set(
      order.orderStatusHistories.map((h) => h.status),
    );

    // Build tracking events
    const trackingEvents = expectedFlow.map((status, index) => {
      const statusHistory = order.orderStatusHistories.find(
        (h) => h.status === status,
      );
      const isCompleted = completedStatuses.has(status as OrderStatus);
      const isCurrent = order.status === status;

      console.log(statusHistory?.createdAt);

      return {
        status: statusMapping[status],
        date: statusHistory
          ? new Date(statusHistory.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: 'UTC',
            })
          : '',
        completed: isCompleted,
        current: isCurrent,
      };
    });

    // Calculate estimated delivery (7 days from order date for example)
    const estimatedDeliveryDate = new Date(order.createdAt);
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7);

    // Format order date
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });

    // Format estimated delivery
    const estimatedDelivery = estimatedDeliveryDate.toLocaleDateString(
      'en-US',
      {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      },
    );

    // Parse shipping address
    const addressParts = order.shippingAddress.split('\n');
    const shippingAddress = {
      name: order.customerName,
      street: addressParts[0] || order.shippingAddress,
      city:
        order.districtName || addressParts[addressParts.length - 1] || 'N/A',
    };

    // Map order items
    const items = order.items.map((item) => ({
      id: item.id,
      name: item.productTitle,
      image: item.product.images[0]?.image || '/placeholder-product.jpg',
      quantity: item.quantity,
      price: item.priceAtPurchase,
      color: item.color,
      size: item.size,
      sku: item.sku,
    }));

    console.log(trackingEvents, 'trackingEvents');

    // Return formatted order data
    return {
      orderNumber: order.orderId,
      orderDate,
      estimatedDelivery,
      status: order.status.toLowerCase(),
      awbNumber: order.awbNumber,
      deliveryMethod: order.deliveryMethod,
      deliveryCharge: order.deliveryCharge,
      discount: order.discount,
      total: order.total,
      items,
      trackingEvents,
      shippingAddress,
    };
  }
}
