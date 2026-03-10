/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-floating-promises */
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
import { NotificationsService } from 'src/notifications/notifications.service';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import puppeteer from 'puppeteer';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationsService,
    private activityLogService: ActivityLogService,
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

  private async recalculateTotalQuantity(
    productId: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    // Sum all quantities of sizes belonging to this product
    const result = await tx.productSize.aggregate({
      _sum: {
        quantity: true,
      },
      where: {
        color: {
          productId: productId,
        },
      },
    });

    const totalQuantity = result._sum.quantity ?? 0;

    await tx.product.update({
      where: { id: productId },
      data: {
        totalProductQuantity: totalQuantity,
      },
    });

    return totalQuantity;
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

  // create a order
  async createOrder(userId: number, dto: CreateOrderDto) {
    // console.log(userId, 'userId');
    // 1. Validate district (especially for COD)
    const district = await this.prisma.district.findUnique({
      where: { id: dto.address.districtId },
    });

    if (!district) {
      throw new BadRequestException('Invalid district selected');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

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
        coupon: true,
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

    const discount = cart.baseSubtotalAtAdd - cart.subtotalAtAdd;

    console.log(discount);

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
            totalProductQuantity: { decrement: item.quantity },
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
          discount,
          customerName: dto.address.name,
          customerPhone: customerPhone,
          shippingAddress: dto.address.fullAddress,
          postCode: dto.address.postCode,
          districtId: dto.address.districtId,
          districtName: district.name,
          deliveryCharge: deliveryCharge,
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

    return order;
  }

  // get invoice
  async getInvoice(id: string) {
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

    return invoice;
  }

  // generate invoice pdf
  async generateInvoicePdf(invoiceId: string, res: Response) {
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

  private async renderPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
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
        support@sakigai.com.bd · sakigai.com.bd
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
      Questions? Email support@sakigai.com.bd<br/>
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

    if (!isAdmin) where.userId;

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

  // track order
  async trackOrder(
    userId: number,
    orderId: string,
    { details = false }: { details?: boolean },
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        OR: [{ orderId }, { trackingToken: orderId }],
      },
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
          },
        },
        orderStatusHistories: {
          orderBy: { createdAt: 'asc' },
        },
        // Conditional includes based on detailed view
        ...(details && {
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

    if (!details) {
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

    const latestPayment = order.payments?.[0] || null;
    const invoice = await this.prisma.invoice.findUnique({
      where: { orderId: order.id },
      select: { id: true },
    });

    return {
      ...baseResponse,
      awbNumber: order.awbNumber,
      deliveryMethod: order.deliveryMethod,
      deliveryCharge: order.deliveryCharge || 0,
      discount: order.discount || 0,
      subtotal:
        order.total - (order.deliveryCharge || 0) + (order.discount || 0),
      total: order.total,
      invoiceId: invoice?.id,

      payment: latestPayment
        ? {
            method: latestPayment.method ?? order.deliveryMethod,
            status: latestPayment.status,
            transactionId: latestPayment.transactionId,
          }
        : null,

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
    orderId: number,
    status: OrderStatus,
    adminId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find order
      const order = await tx.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // 2. Update order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
        },
      });

      // 3. Save status history
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note: `Order status changed to ${status}`,
        },
      });

      this.activityLogService.log({
        adminId,
        action: 'UPDATE_ORDER',
        module: 'ORDER',
        targetId: order.id,
        targetLabel: '',
        oldValue: {
          status: order.status,
        },
        newValue: {
          status: updatedOrder.status,
        },
      });

      return updatedOrder;
    });
  }
}
