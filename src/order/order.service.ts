/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-floating-promises */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CollectRemainderDto } from './dto/collect-remainder.dto';
import {
  OrderStatus,
  PaymentMethod,
  Prisma,
  StockAdjustReason,
} from '@prisma/client';
import { nanoid } from 'nanoid';
import { NotificationsService } from 'src/notifications/notifications.service';
import { Response } from 'express';
import puppeteer from 'puppeteer';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as crypto from 'crypto';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import {
  StockEventsGateway,
  StockUpdatedPayload,
} from '../realtime/stock-events.gateway';
import { PaymentMethodConfigService } from '../payment-method-config/payment-method-config.service';
import { ReservationService } from 'src/reservation/reservation.service';
import { OrderStatusService } from 'src/order-status/order-status.service';
import {
  computeCouponDiscount,
  CouponWithCategories,
  isCouponWithinWindow,
  validateCouponAgainstCart,
} from 'src/cms/coupon-pricing.util';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
    private activityLogService: ActivityLogService,
    @InjectQueue('notification') private notificationQueue: Queue,
    private stockLedgerService: StockLedgerService,
    private stockEventsGateway: StockEventsGateway,
    private paymentMethodConfigService: PaymentMethodConfigService,
    private reservationService: ReservationService,
    private orderStatusService: OrderStatusService,
  ) {}

  private async generateOrderId(tx: Prisma.TransactionClient) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const countToday = await tx.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    });

    const sequence = String(countToday + 1).padStart(6, '0');

    // 4 digit random number
    const random = Math.floor(1000 + Math.random() * 9000);

    return `ORD-${dateStr}-${random}-${sequence}`;
  }

  normalizeBDPhone(phone: string) {
    let p = phone.replace(/\D/g, ''); // remove all non-digits
    if (p.startsWith('0')) p = '+880' + p.slice(1);
    else if (p.startsWith('1')) p = '+880' + p;
    else if (!p.startsWith('+880')) p = '+880' + p;
    return p;
  }

  private async generateInvoiceNo(tx: Prisma.TransactionClient) {
    const count = await tx.invoice.count();
    const next = count + 1;
    return `SKG-${new Date().getFullYear()}-${String(next).padStart(5, '0')}`;
  }

  /** Orders in these statuses haven't been physically fulfilled yet, so a stock
   * shortfall on one of their items is still actionable by the Order Manager.
   * Once an order ships, the pieces are already reserved/out the door — stock
   * moves after that point are no longer this order's problem. */
  private static readonly UNFULFILLED_STATUSES: OrderStatus[] = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'PACKED',
    'ON_HOLD',
  ];

  private orderHasOutOfStockItem(
    status: OrderStatus,
    items: {
      productSizeId: number | null;
      productSize?: { quantity: number } | null;
    }[],
  ): boolean {
    if (!OrderService.UNFULFILLED_STATUSES.includes(status)) return false;
    return items.some(
      (item) =>
        item.productSizeId != null && (item.productSize?.quantity ?? 0) <= 0,
    );
  }

  // create a order
  async createOrder(userId: number, dto: CreateOrderDto) {
    console.log('CreateOrderDto', dto, 'CreateOrderDto');
    // 1. Validate district (especially for COD)
    const district = await this.prisma.city.findUnique({
      where: { id: dto.address.districtId },
    });

    if (!district) {
      throw new BadRequestException('Invalid district selected');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Phone OTP gate: verify if ordering phone differs from account phone
    const normalizedOrderPhone = this.normalizeBDPhone(dto.address.phone);
    const normalizedUserPhone = user?.phone
      ? this.normalizeBDPhone(user.phone)
      : null;

    if (!normalizedUserPhone || normalizedOrderPhone !== normalizedUserPhone) {
      if (!dto.otp) {
        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await this.prisma.oTP.updateMany({
          where: { userId, type: 'phone', verified: false },
          data: { expiresAt: new Date() },
        });

        await this.prisma.oTP.create({
          data: {
            userId,
            code,
            type: 'phone',
            expiresAt,
            phone: normalizedOrderPhone,
          },
        });

        await this.notificationQueue.add('sendSMS', {
          phone: normalizedOrderPhone,
          message: `Your Sakigai verification OTP is ${code}. It will expire in 10 minutes.`,
        });

        return {
          status: 'OTP_REQUIRED',
          otpSentTo: 'phone',
          message:
            'The phone number differs from your account. Please verify with the OTP sent to this number.',
        };
      }

      const otpData = await this.prisma.oTP.findFirst({
        where: {
          userId,
          code: dto.otp,
          type: 'phone',
          verified: false,
          expiresAt: {
            gte: new Date(),
          },
        },
      });

      if (!otpData) throw new BadRequestException('Invalid or expired OTP');

      await this.prisma.oTP.update({
        where: { id: otpData.id },
        data: { verified: true },
      });
    }

    // 2. Fetch user's cart items
    const cart = await this.prisma.cart.findUnique({
      where: { id: dto.cartId },
      include: {
        items: {
          include: {
            productSize: {
              include: {
                color: {
                  include: {
                    product: {
                      include: {
                        subCategories: {
                          include: {
                            subCategory: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        coupon: { include: { categories: true } },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    if (dto.paymentMethod === 'COD') {
      // District check
      if (!district.isCODAvailable) {
        throw new BadRequestException(
          'Cash on Delivery is not available for this district',
        );
      }

      // Subcategory check
      for (const item of cart.items) {
        const productSubCategories =
          item.productSize?.color?.product?.subCategories ?? [];

        for (const ps of productSubCategories) {
          if (!ps.subCategory.isCODAvailable) {
            throw new BadRequestException(
              `Cash on Delivery is not available for product "${item.productSize?.color?.product?.title}"`,
            );
          }
        }
      }
    }

    if (cart.userId !== userId || cart.status !== 'ACTIVE') {
      throw new ForbiddenException('Invalid cart');
    }

    // 2a. Check for price changes
    const priceChangedItems: string[] = [];
    for (const item of cart.items) {
      const productPrice = item?.productSize?.price ?? 0;
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
        `The price of one or more product(s) has increased. Your cart has been updated with the new price.`,
      );
    }

    // 3. Calculate totals
    const subtotal = cart.subtotalAtAdd ?? 0;

    // Re-validate the coupon against trusted DB state right now — never
    // trust whatever discount the cart carried earlier. A coupon can go
    // stale between "apply" and "place order" (expired, deactivated, no
    // longer eligible for what's left in the cart), so we recompute from
    // scratch and reject the order outright if it can no longer be
    // honoured, rather than silently charging full price.
    let discount = 0;
    let freeDelivery = false;
    let appliedCoupon: CouponWithCategories | null = null;

    if (cart.couponId) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { id: cart.couponId },
        include: { categories: true },
      });

      if (!coupon) {
        throw new BadRequestException('Applied coupon is no longer available');
      }

      const window = isCouponWithinWindow(coupon);
      if (!window.ok) {
        throw new BadRequestException(window.reason);
      }

      const eligibilityItems = cart.items.map((item) => ({
        subtotalAtAdd: item.subtotalAtAdd,
        categoryIds: (
          item.productSize?.color?.product?.subCategories ?? []
        ).map((psc) => psc.subCategory.categoryId),
      }));

      const discountResult = computeCouponDiscount(eligibilityItems, coupon);
      const cartCheck = validateCouponAgainstCart(coupon, discountResult);
      if (!cartCheck.ok) {
        throw new BadRequestException(cartCheck.reason);
      }

      discount = discountResult.discountAmount;
      freeDelivery = discountResult.freeDelivery;
      appliedCoupon = coupon;
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

    // Delivery fee is always server-computed from the validated district —
    // never trust a client-supplied value here, or a customer could zero out shipping.
    const deliveryCharge = freeDelivery
      ? 0
      : (district.deliveryFee ??
        Number(process.env.DEFAULT_DELIVERY_FEE) ??
        120);
    const total = subtotal - discount + deliveryCharge;

    if (dto.paymentMethod === 'COD') {
      await this.paymentMethodConfigService.assertEnabled(
        PaymentMethod.COD,
        total,
      );
    }

    // Advance payment only applies to COD orders; ONLINE orders are paid in full as today.
    const advanceSubCategories = cart.items
      .flatMap((item) => item.productSize?.color?.product?.subCategories ?? [])
      .map((ps) => ps.subCategory)
      .filter((sc) => sc.isAdvancePayment);
    const advancePercentage = advanceSubCategories.length
      ? Math.max(...advanceSubCategories.map((sc) => sc.advancePercentage))
      : 0;
    const advanceRequired =
      dto.paymentMethod === 'COD' && advancePercentage > 0;
    const advanceAmount = advanceRequired
      ? Math.round(total * advancePercentage) / 100
      : 0;
    const remainingAmount = advanceRequired ? total - advanceAmount : 0;

    const stockEvents: StockUpdatedPayload[] = [];

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
        const productId = item.productSize.color.productId;

        const result = await this.stockLedgerService.recordAdjustment(tx, {
          productSizeId: item.productSizeId,
          productId,
          delta: -item.quantity,
          reason: StockAdjustReason.ORDER_PLACED,
          productLabel: item.productSize.color.product.title,
        });

        await tx.productSize.update({
          where: { id: item.productSizeId },
          data: { soldCount: { increment: item.quantity } },
        });

        await tx.product.update({
          where: { id: productId },
          data: { soldCount: { increment: item.quantity } },
        });

        stockEvents.push({
          productSizeId: item.productSizeId,
          productId,
          quantity: result.quantityAfter,
          lowStockAt: result.lowStockAt,
        });
      }

      // Coupon usage limits, enforced atomically inside the same
      // transaction as the order — this is the chokepoint that makes "two
      // customers race for the last available use" safe. perUserLimit is
      // read-then-write (a narrow TOCTOU window for the *same* customer
      // double-submitting), but the global usageLimit guard below is a
      // single conditional UPDATE, so Postgres row-locking serializes
      // concurrent attempts from *different* customers and only one can
      // ever claim the last slot.
      if (appliedCoupon) {
        if (appliedCoupon.perUserLimit != null) {
          const usedByUser = await tx.order.count({
            where: { userId, couponId: appliedCoupon.id },
          });
          if (usedByUser >= appliedCoupon.perUserLimit) {
            throw new BadRequestException(
              'You have already used this coupon the maximum number of times',
            );
          }
        }

        const guarded = await tx.coupon.updateMany({
          where: {
            id: appliedCoupon.id,
            ...(appliedCoupon.usageLimit != null
              ? { usedCount: { lt: appliedCoupon.usageLimit } }
              : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (guarded.count === 0) {
          throw new BadRequestException(
            'This coupon has reached its usage limit',
          );
        }
      }

      const orderId = await this.generateOrderId(tx);
      const trackingToken = nanoid(10); // generate 10-char token

      // 4. Create order
      const order = await tx.order.create({
        data: {
          userId,
          orderId,
          trackingToken,
          discount,
          customerName: dto.address.name,
          customerPhone: customerPhone,
          shippingAddress: dto.address.fullAddress,
          zoneId: dto.address.zoneId || null,
          zoneName: dto.address.zoneName || null,
          areaId: dto.address.areaId || null,
          areaName: dto.address.areaName || null,
          postCode: dto.address.postCode,
          districtId: dto.address.districtId,
          districtName: district.name,
          deliveryCharge: deliveryCharge,
          deliveryMethod: dto.paymentMethod === 'COD' ? 'COD' : 'ONLINE',
          couponCode: appliedCoupon?.code,
          couponId: appliedCoupon?.id,
          total,
          advanceRequired,
          advancePercentage,
          advanceAmount,
          remainingAmount,
          items: {
            create: cart.items.map((item) => ({
              productId: item?.productSize?.color?.productId,
              productTitle: item?.productSize?.color?.product?.title,
              sku: item?.productSize?.sku,
              productSizeId: item?.productSizeId,
              color: item?.color,
              size: item?.size,
              quantity: item?.quantity,
              priceAtPurchase: item?.productSize?.price ?? 0,
              basePriceAtPurchase: item?.productSize?.basePrice ?? 0,
              totalPriceAtPurchase:
                (item?.productSize?.price ?? 0) * item?.quantity,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      const invoiceNo = await this.generateInvoiceNo(tx);

      await tx.invoice.create({
        data: {
          invoiceNo,
          orderId: order.id,
          subtotal: order.total - deliveryCharge,
          discount: order.discount ?? 0,
          shippingCost: deliveryCharge ?? 0,
          tax: 0,
          total: order.total,
        },
      });

      if (user) {
        this.notificationService.sendOrderConfirmation(
          {
            email: user.email ?? '',
            phone: user.phone ?? '',
          },
          {
            customerName: order.customerName,
            orderId: order.orderId,
            trackingToken: order.trackingToken,
            shippingAddress: order.shippingAddress,
            districtName: order.districtName,
            postCode: order.postCode,
            items:
              order.items && order.items.length > 0
                ? order.items.map((i) => ({
                    productTitle: i.productTitle,
                    size: i.size,
                    color: i.color,
                    quantity: i.quantity,
                    priceAtPurchase: i.priceAtPurchase,
                  }))
                : [],
            subtotal: order.items.reduce(
              (sum, i) => sum + Number(i.totalPriceAtPurchase),
              0,
            ),
            deliveryCharge: order.deliveryCharge,
            total: order.total,
          },
        );
      }

      // 5. Optionally clear cart
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'CHECKED_OUT' },
      });

      return order;
    });

    for (const event of stockEvents) {
      this.stockEventsGateway.emitStockUpdated(event);
    }

    void this.triggerFraudCheckIfNeeded(userId, order.customerPhone);
    return order;
  }

  private async triggerFraudCheckIfNeeded(
    userId: number,
    phone: string,
  ): Promise<void> {
    try {
      const RECHECK_DAYS = 30;
      const recent = await this.prisma.fraudCheck.findFirst({
        where: { userId },
        orderBy: { checkedAt: 'desc' },
      });
      const isStale =
        !recent ||
        Date.now() - recent.checkedAt.getTime() > RECHECK_DAYS * 86_400_000;
      if (!isStale) return;

      const url = process.env.FRAUDURL;
      const apiKey = process.env.FRAUD_SPY_BD_API_KEY;
      if (!url || !apiKey) return;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: apiKey.startsWith('Bearer ')
            ? apiKey
            : `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) return;

      const data = await res.json();
      const overall = data.overall ?? {
        total: 0,
        delivered: 0,
        returned: 0,
        success_ratio: 0,
      };
      const reports = data.fraud_reports ?? {
        count: 0,
        risk: { level: 'Low', score: 0 },
      };

      const score = reports.risk?.score ?? 0;
      const count = reports.count ?? 0;
      const level = (reports.risk?.level ?? 'Low').toLowerCase();
      const total = overall.total ?? 0;
      const returned = overall.returned ?? 0;
      const rawRatio = overall.success_ratio ?? 0;
      const successRatio = rawRatio > 1 ? rawRatio / 100 : rawRatio;
      const returnRate = total > 0 ? returned / total : 0;

      let computedStatus: 'SAFE' | 'SUSPICIOUS' | 'DOUBTFUL' | 'BLOCKED' =
        'DOUBTFUL';
      if (
        score >= 70 ||
        count >= 5 ||
        ['high', 'critical', 'very high'].includes(level) ||
        (total >= 5 && returnRate >= 0.8)
      ) {
        computedStatus = 'BLOCKED';
      } else if (
        score >= 40 ||
        count >= 2 ||
        level === 'medium' ||
        (total >= 3 && returnRate >= 0.5) ||
        (count >= 1 && returnRate >= 0.3)
      ) {
        computedStatus = 'SUSPICIOUS';
      } else if (
        total >= 3 &&
        successRatio >= 0.7 &&
        count === 0 &&
        score < 20
      ) {
        computedStatus = 'SAFE';
      }

      await this.prisma.fraudCheck.create({
        data: {
          phone,
          totalOrders: overall.total,
          delivered: overall.delivered,
          returned: overall.returned,
          successRatio: overall.success_ratio,
          fraudReportCount: reports.count,
          riskLevel: reports.risk.level,
          riskScore: reports.risk.score,
          computedStatus,
          userId,
        },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { fraudStatus: computedStatus },
      });
    } catch {
      // Non-critical — silently swallow
    }
  }

  // get invoice
  async getInvoice(
    id: string,
    requestingUser: { userId: number; role: string },
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    this.assertInvoiceAccess(invoice, requestingUser);

    return invoice;
  }

  // generate invoice pdf
  async generateInvoicePdf(
    invoiceId: string,
    requestingUser: { userId: number; role: string },
    res: Response,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    // console.log('invoice received:', invoice.id);

    this.assertInvoiceAccess(invoice, requestingUser);

    const html = this.buildHtml(invoice);
    const buffer = await this.renderPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${invoice.invoiceNo}.pdf`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // Customers may only reach their own order's invoice; staff/admin may reach any.
  private assertInvoiceAccess(
    invoice: { order: { userId: number | null } },
    requestingUser: { userId: number; role: string },
  ) {
    const isStaff = requestingUser?.role !== 'CUSTOMER';
    const isOwner =
      invoice.order.userId !== null &&
      invoice.order.userId === requestingUser?.userId;

    if (!isStaff && !isOwner) {
      throw new ForbiddenException('You do not have access to this invoice');
    }
  }

  private async renderPdf(html: string): Promise<Buffer> {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
        protocolTimeout: 20_000,
      });
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 15_000,
      });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        timeout: 15_000,
      });
      return Buffer.from(pdf);
    } catch (err) {
      this.logger.error('Invoice PDF render failed', err as Error);
      throw new ServiceUnavailableException(
        'Could not generate the invoice PDF right now. Please try again shortly.',
      );
    } finally {
      await browser?.close();
    }
  }

  private taka(n: number): string {
    return `৳ ${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 2 })}`;
  }

  private fmtDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private buildHtml(invoice: any): string {
    const user = invoice.order?.user;
    const items: any[] = invoice.order?.items ?? [];

    const statusColors: Record<
      string,
      { bg: string; color: string; border: string }
    > = {
      PAID: { bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
      UNPAID: { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
      CANCELLED: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
      REFUNDED: { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
    };
    const sc = statusColors[invoice.status] ?? statusColors.UNPAID;

    const itemRows = items
      .map(
        (item) => `
        <tr>
          <td class="item-cell">
            <span class="item-name">${item.productTitle}</span>
            ${item.sku ? `<span class="sku">SKU: ${item.sku}</span>` : ''}
          </td>
          <td class="center mono">${item.quantity}</td>
          <td class="right mono">${this.taka(item.priceAtPurchase)}</td>
          <td class="right mono bold">${this.taka(item.quantity * item.priceAtPurchase)}</td>
        </tr>`,
      )
      .join('');

    const subtotal = items.reduce(
      (s: number, i: any) => s + i.quantity * i.priceAtPurchase,
      0,
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-size: 13px;
      color: #1e293b;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .mono { font-family: 'DM Mono', 'Courier New', monospace; }

    .header {
      background: #0f172a;
      padding: 40px 48px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: #e2c97e;
    }
    .brand-tagline { color: #64748b; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px; }
    .brand-contact { color: #475569; font-size: 11px; margin-top: 16px; line-height: 1.7; }
    .inv-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px;
      font-weight: 300;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: #cbd5e1;
      text-align: right;
    }
    .inv-number { font-family: 'DM Mono', monospace; font-size: 12px; color: #e2c97e; text-align: right; margin-top: 6px; }
    .status-badge {
      display: inline-block;
      margin-top: 12px;
      padding: 4px 14px;
      border-radius: 20px;
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: ${sc.bg};
      color: ${sc.color};
      border: 1px solid ${sc.border};
    }
    .gold-rule { height: 3px; background: linear-gradient(to right, #e2c97e, #c9a84c, #0f172a); }

    .meta-row { display: flex; border-bottom: 1px solid #f1f5f9; }
    .meta-block { flex: 1; padding: 24px 32px; border-right: 1px solid #f1f5f9; }
    .meta-block:last-child { border-right: none; }
    .meta-label { font-family: 'DM Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.18em; color: #94a3b8; margin-bottom: 8px; }
    .meta-value { font-size: 14px; color: #0f172a; font-weight: 600; line-height: 1.5; }
    .meta-sub   { font-size: 11px; color: #64748b; margin-top: 2px; line-height: 1.6; }
    .meta-mono  { font-family: 'DM Mono', monospace; font-size: 11px; color: #475569; word-break: break-all; }

    .table-wrap { padding: 32px 48px 24px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
    thead th { padding: 11px 8px; font-family: 'DM Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; }
    thead th:first-child { text-align: left; padding-left: 0; width: 44%; }
    tbody tr { border-bottom: 1px solid #f8fafc; }
    tbody tr:last-child { border-bottom: 2px solid #0f172a; }
    tbody td { padding: 14px 8px; vertical-align: top; }
    tbody td:first-child { padding-left: 0; }
    .item-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .sku { display: block; font-family: 'DM Mono', monospace; font-size: 10px; color: #94a3b8; margin-top: 2px; }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: 500; color: #0f172a; }

    .totals-wrap { display: flex; justify-content: flex-end; padding: 0 48px 36px; }
    .totals-inner { width: 220px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #64748b; border-bottom: 1px solid #f8fafc; }
    .totals-row .val { font-family: 'DM Mono', monospace; }
    .totals-row.green .val { color: #15803d; }
    .totals-grand { display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; border-top: 2px solid #0f172a; margin-top: 4px; }
    .totals-grand .label { font-size: 17px; font-weight: 600; color: #0f172a; }
    .totals-grand .val   { font-family: 'DM Mono', monospace; font-size: 15px; font-weight: 500; color: #0f172a; }

    .thankyou { text-align: center; padding: 20px 48px 28px; font-size: 13px; color: #94a3b8; font-style: italic; }

    .footer { background: #faf9f7; border-top: 1px solid #f1f5f9; padding: 20px 48px; display: flex; justify-content: space-between; align-items: center; }
    .footer-note { font-size: 10px; color: #94a3b8; line-height: 1.7; }
    .footer-brand { font-family: 'DM Mono', monospace; font-size: 10px; color: #cbd5e1; letter-spacing: 0.25em; text-transform: uppercase; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand-name">Sakigai</div>
      <div class="brand-tagline">Furniture · Crafted for your home</div>
      <div class="brand-contact">
        Dhaka, Bangladesh<br/>
        support@ondorkotha.com.bd · ondorkotha.com.bd
      </div>
    </div>
    <div>
      <div class="inv-title">Invoice</div>
      <div class="inv-number">${invoice.invoiceNo}</div>
      <div style="text-align:right">
        <span class="status-badge">${invoice.status ?? 'UNPAID'}</span>
      </div>
    </div>
  </div>

  <div class="gold-rule"></div>

  <div class="meta-row">
    <div class="meta-block">
      <div class="meta-label">Billed To</div>
      <div class="meta-value">${user?.name ?? '—'}</div>
      ${user?.email ? `<div class="meta-sub">${user.email}</div>` : ''}
      ${user?.phone ? `<div class="meta-sub mono">${user.phone}</div>` : ''}
    </div>
    <div class="meta-block">
      <div class="meta-label">Issued</div>
      <div class="meta-value" style="font-size:13px;font-weight:400">${this.fmtDate(invoice.issuedAt)}</div>
      ${
        invoice.dueDate
          ? `
        <div class="meta-label" style="margin-top:14px">Due</div>
        <div class="meta-value" style="font-size:13px;font-weight:400">${this.fmtDate(invoice.dueDate)}</div>
      `
          : ''
      }
    </div>
    <div class="meta-block">
      <div class="meta-label">Order Ref</div>
      <div class="meta-mono">${invoice.order?.id ?? '—'}</div>
      ${
        invoice.paidAt
          ? `
        <div class="meta-label" style="margin-top:14px">Paid On</div>
        <div class="meta-value" style="font-size:13px;font-weight:400">${this.fmtDate(invoice.paidAt)}</div>
      `
          : ''
      }
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <div class="totals-wrap">
    <div class="totals-inner">
      <div class="totals-row">
        <span>Subtotal</span><span class="val">${this.taka(subtotal)}</span>
      </div>
      ${
        (invoice.discount ?? 0) > 0
          ? `
      <div class="totals-row green">
        <span>Discount</span><span class="val">− ${this.taka(invoice.discount)}</span>
      </div>`
          : ''
      }
      <div class="totals-row">
        <span>Shipping</span>
        <span class="val">${(invoice.shippingCost ?? 0) > 0 ? this.taka(invoice.shippingCost) : 'Free'}</span>
      </div>
      ${
        (invoice.tax ?? 0) > 0
          ? `
      <div class="totals-row">
        <span>Tax</span><span class="val">${this.taka(invoice.tax)}</span>
      </div>`
          : ''
      }
      <div class="totals-grand">
        <span class="label">Total</span>
        <span class="val">${this.taka(invoice.total)}</span>
      </div>
    </div>
  </div>

  <div class="thankyou">Thank you for choosing Sakigai. We hope you love your furniture.</div>

  <div class="footer">
    <div class="footer-note">
      Questions? Email support@ondorkotha.com.bd<br/>
      Computer-generated invoice — no signature required.
    </div>
    <div class="footer-brand">Sakigai · ${new Date().getFullYear()}</div>
  </div>

</body>
</html>`;
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
      from,
      to,
    }: {
      page?: number;
      limit?: number;
      search?: string;
      status?: OrderStatus;
      orderBy?: Record<string, 'asc' | 'desc'>;
      thumb?: boolean;
      from?: string;
      to?: string;
    },
  ) {
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const isAdmin = user.role != 'CUSTOMER';

    const where: any = {};

    if (!isAdmin) where.userId = userId;

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

    if (from || to) {
      where.createdAt = {};

      if (from) {
        where.createdAt.gte = new Date(from);
      }

      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    let data: any[];
    let total: number;

    const whereCondition = !isAdmin ? { userId: userId } : {};

    const statusGroups = await this.prisma.order.groupBy({
      by: ['status'],
      where: whereCondition,
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
      PROCESSING: 0,
      RETURN_REQUESTED: 0,
      FAILED: 0,
      ON_HOLD: 0,
      PARTIALLY_DELIVERED: 0,
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
              include: {
                product: {
                  select: {
                    id: true,
                    slug: true,
                    images: { take: 1, orderBy: { serialNo: 'asc' } },
                  },
                },
                productSize: { select: { quantity: true } },
              },
            },
            payments: { orderBy: { createdAt: 'desc' } },
            user: { select: { id: true, fraudStatus: true } },
            invoice: { select: { id: true } },
          },
        }),
        this.prisma.order.count({ where }),
      ]);

      data = data.map((order) => ({
        ...order,
        hasOutOfStockItem: this.orderHasOutOfStockItem(
          order.status,
          order.items,
        ),
      }));
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

  // track order
  async trackOrder(
    userId: number,
    orderId: string,
    { detailsValue = false }: { detailsValue?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const isAdmin = user.role != 'CUSTOMER';

    const whereCondition = {
      OR: [{ orderId }, { trackingToken: orderId }],
      ...(!isAdmin && userId ? { userId } : {}),
    };

    const order = await this.prisma.order.findFirst({
      where: whereCondition,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                slug: true,
                images: {
                  take: 1,
                  orderBy: { serialNo: 'asc' },
                },
              },
            },
            productSize: { select: { quantity: true } },
          },
        },
        orderStatusHistories: {
          orderBy: { createdAt: 'asc' },
        },
        // Conditional includes based on detailed view
        ...(detailsValue && {
          district: true,
          user: {
            select: { id: true, email: true },
          },
          payments: {
            // take: 1,
            orderBy: { createdAt: 'desc' },
          },
        }),
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const statusMapping: Record<OrderStatus, string> = {
      PENDING: 'Order Placed',
      CONFIRMED: 'Order Confirmed',
      PACKED: 'Packed',
      SHIPPED: 'Shipped',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      RETURNED: 'Returned',
      PROCESSING: 'Processing',
      RETURN_REQUESTED: 'Return Requested',
      FAILED: 'Failed',
      ON_HOLD: 'On Hold',
      PARTIALLY_DELIVERED: 'Partially Delivered',
    };

    const isSpecialStatus = ['CANCELLED', 'RETURNED'].includes(order.status);
    const expectedFlow = isSpecialStatus
      ? ['PENDING', order.status]
      : ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'];

    const trackingEvents = expectedFlow.map((status) => {
      const history = order.orderStatusHistories.find(
        (h) => h.status === status,
      );

      return {
        status: statusMapping[status as OrderStatus],
        date: history
          ? new Date(history.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
          : '',
        completed: !!history,
        current: order.status === status,
      };
    });

    const baseResponse = {
      id: order.id,
      orderNumber: order.orderId,
      trackingToken: order.trackingToken,
      orderDate: new Date(order.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      estimatedDelivery: new Date(
        new Date(order.createdAt).setDate(
          new Date(order.createdAt).getDate() + 7,
        ),
      ).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      status: order.status,
      trackingEvents,
    };

    if (!detailsValue) {
      return {
        ...baseResponse,
        items: order.items.map((item) => ({
          name: item.productTitle,
          image: item.product.images[0]?.image || '/placeholder-product.jpg',
          quantity: item.quantity,
        })),
        shippingAddress: {
          name: order.customerName,
          phone: order.customerPhone,
          address: order.shippingAddress,
          district: order.district?.name || order.districtName,
        },
      };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    });

    return {
      ...baseResponse,
      hasOutOfStockItem: this.orderHasOutOfStockItem(order.status, order.items),
      awbNumber: order.awbNumber,
      deliveryMethod: order.deliveryMethod,
      deliveryCharge: order.deliveryCharge || 0,
      discount: order.discount || 0,
      subtotal:
        order.total - (order.deliveryCharge || 0) + (order.discount || 0),
      total: order.total,
      invoiceId: invoice?.id,
      paymentStatus: order.paymentStatus,
      advanceRequired: order.advanceRequired,
      advancePercentage: order.advancePercentage,
      advanceAmount: order.advanceAmount,
      remainingAmount: order.remainingAmount,

      payments: (order.payments ?? []).map((p) => ({
        id: p.id,
        method: p.method ?? order.deliveryMethod,
        status: p.status,
        transactionId: p.transactionId,
        amount: p.amount,
        phase: p.phase,
      })),

      shippingAddress: {
        name: order.customerName,
        phone: order.customerPhone,
        address: order.shippingAddress,
        district: order.district?.name || order.districtName,
      },

      items: order.items.map((item) => ({
        id: item.id,
        name: item.productTitle,
        image: item.product.images[0]?.image || '/placeholder-product.jpg',
        quantity: item.quantity,
        price: item.priceAtPurchase,
        color: item.color,
        size: item.size,
        sku: item.sku,
        productSizeId: item.productSizeId,
        isOutOfStock:
          item.productSizeId != null && (item.productSize?.quantity ?? 0) <= 0,
        subtotal: item.totalPriceAtPurchase,
        isReviewed: item.isReviewed,
        slug: item.product.slug,
        productId: item.product.id,
      })),

      customer: {
        id: order.user?.id,
        email: order.customerEmail || order.user?.email,
      },
    };
  }

  // update status of order
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    adminId: number,
  ) {
    // Order status is meant to be driven by the courier webhook end-to-end —
    // this manual dropdown is an escape hatch, off by default. Flip
    // MANUAL_ORDER_STATUS_UPDATE=true in env to let admins set it by hand
    // (e.g. courier webhook is down, or a COD/return case the courier never reports).
    if (process.env.MANUAL_ORDER_STATUS_UPDATE !== 'true') {
      throw new BadRequestException(
        'Manual order status changes are disabled — status is driven by the courier webhook. ' +
          'Set MANUAL_ORDER_STATUS_UPDATE=true in the environment to re-enable manual updates.',
      );
    }

    let previousStatus: OrderStatus | undefined;
    let stockEvents: StockUpdatedPayload[] = [];

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Find order
      const order = await tx.order.findUnique({
        where: { orderId: orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Same hard gate as the courier-booking path (CourierService.createShipment)
      // — the manual status dropdown must not be a way to bypass "every
      // reserved piece must be scan-confirmed as Picked before shipping."
      if (
        status === OrderStatus.SHIPPED &&
        order.status !== OrderStatus.SHIPPED
      ) {
        const pickGate = await this.reservationService.checkFullyPickedForOrder(
          order.id,
          tx,
        );
        if (!pickGate.isFullyPicked) {
          throw new BadRequestException(
            `Cannot mark as Shipped — only ${pickGate.pickedCount}/${pickGate.requiredCount} piece(s) have been picked for this order`,
          );
        }
      }

      // 2. Apply the transition — restores stock and releases reservations
      // for CANCELLED/FAILED/RETURNED via the same chokepoint every other
      // order-status mutation (courier webhook, courier shipment sync) uses.
      const result = await this.orderStatusService.applyStatusChange(tx, {
        orderPk: order.id,
        newStatus: status,
        adminId,
      });

      previousStatus = result.previousStatus;
      stockEvents = result.stockEvents;

      this.activityLogService.log({
        adminId,
        action: 'UPDATE_ORDER',
        module: 'ORDER',
        targetId: order.id,
        targetLabel: '',
        oldValue: {
          status: result.previousStatus,
        },
        newValue: {
          status: result.order.status,
          stockRestored: result.order.stockRestored,
        },
      });

      return result.order;
    });

    for (const event of stockEvents) {
      this.stockEventsGateway.emitStockUpdated(event);
    }

    // Customer-facing notification is a side effect of a committed status
    // change — fired after the transaction settles, and never allowed to
    // fail the admin's status-update request even if the queue is down.
    if (previousStatus !== updatedOrder.status) {
      try {
        await this.notificationService.sendStatusUpdate(
          {
            email: updatedOrder.customerEmail,
            phone: updatedOrder.customerPhone,
          },
          {
            orderId: updatedOrder.orderId,
            customerName: updatedOrder.customerName,
            status: updatedOrder.status,
            trackingToken: updatedOrder.trackingToken,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to queue status-update notification for order ${updatedOrder.orderId}`,
          err,
        );
      }
    }

    return updatedOrder;
  }

  // Records cash collected by the courier for a COD order's remaining
  // balance, after its advance deposit was already paid online.
  async collectRemainder(
    orderId: string,
    dto: CollectRemainderDto,
    adminId: number,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.paymentStatus !== 'PARTIALLY_PAID' ||
      order.remainingAmount <= 0
    ) {
      throw new BadRequestException(
        'This order has no outstanding advance-payment balance to collect',
      );
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.payment.create({
        data: {
          orderId: order.id,
          method: 'COD',
          phase: 'REMAINDER',
          gateway: 'COD',
          amount: order.remainingAmount,
          paidAmount: order.remainingAmount,
          dueAmount: 0,
          transactionId: `COD_${order.orderId}_${now.getTime()}`,
          status: 'PAID',
          verificationStatus: 'VERIFIED',
          initiatedAt: now,
          completedAt: now,
          collectedBy: dto.collectedBy,
          collectedAt: now,
        },
      });

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          remainingAmount: 0,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: updated.status,
          note: `Remaining amount ${order.remainingAmount} collected on delivery by ${dto.collectedBy}.`,
        },
      });

      return updated;
    });

    this.activityLogService.log({
      adminId,
      action: 'COLLECT_REMAINDER',
      module: 'ORDER',
      targetId: order.id,
      targetLabel: '',
      oldValue: {
        paymentStatus: order.paymentStatus,
        remainingAmount: order.remainingAmount,
      },
      newValue: {
        paymentStatus: updatedOrder.paymentStatus,
        remainingAmount: updatedOrder.remainingAmount,
      },
    });

    return updatedOrder;
  }
}
