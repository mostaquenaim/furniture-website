/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
    const statusCounts: Record<OrderStatus, number> | undefined = undefined;

    if (thumb) {
      const [dataRaw, totalRaw, statusGroups] = await this.prisma.$transaction([
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
        this.prisma.order.groupBy({
          by: ['status'],
          where,
          orderBy: { status: 'asc' }, // required by Prisma now
          _count: { status: true },
        }),
      ]);

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
        if (g._count && typeof g._count === 'object' && 'status' in g._count) {
          statusCounts[g.status] = g._count.status ?? 0;
        }
      });

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
      statusCounts: statusCounts ?? undefined, // only present if thumb=true
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  getOrderById(id: number) {
    return this.prisma.order.findUnique({ where: { id } });
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
}
