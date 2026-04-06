// src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderStatus, UserRole } from '@prisma/client';

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Main entry point ────────────────────────────────────────────────────────

  async getDashboardData(startStr: string, endStr: string) {
    const range: DateRange = {
      start: new Date(startStr),
      end: new Date(new Date(endStr).setHours(23, 59, 59, 999)),
    };

    const [stats, salesTrend, topProducts, recentOrders, topViewedProducts] =
      await Promise.all([
        this.getStats(range),
        this.getSalesTrend(range),
        this.getTopProducts(range),
        this.getRecentOrders(),
        this.getTopViewedProducts(range),
      ]);

    return { stats, salesTrend, topProducts, recentOrders, topViewedProducts };
  }

  // ── Stats Cards ─────────────────────────────────────────────────────────────

  private async getStats(range: DateRange) {
    const revenueStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.PACKED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const [
      revenueAgg,
      totalOrders,
      activeUserRows,
      inventoryAlerts,
      newUsersInRange,
    ] = await Promise.all([
      // Revenue: sum `total` on Order (the actual field name)
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          createdAt: { gte: range.start, lte: range.end },
          status: { in: revenueStatuses },
        },
      }),

      // All orders in range regardless of status
      this.prisma.order.count({
        where: { createdAt: { gte: range.start, lte: range.end } },
      }),

      // Distinct users who placed orders in range
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: range.start, lte: range.end },
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),

      // Low-stock alert: ProductSize rows with quantity > 0 and <= 5
      this.prisma.productSize.count({
        where: { quantity: { gt: 0, lte: 5 } },
      }),

      // New customers registered in range (denominator for conversion rate)
      this.prisma.user.count({
        where: {
          createdAt: { gte: range.start, lte: range.end },
          role: UserRole.CUSTOMER,
        },
      }),
    ]);

    const totalRevenue = revenueAgg._sum.total ?? 0;
    const uniqueActiveUsers = activeUserRows.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Conversion rate: customers who ordered / new customers registered
    const conversionRate =
      newUsersInRange > 0
        ? parseFloat(((uniqueActiveUsers / newUsersInRange) * 100).toFixed(1))
        : 0;

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      activeUsers: uniqueActiveUsers,
      inventoryAlerts,
      conversionRate,
    };
  }

  // ── Sales Trend ─────────────────────────────────────────────────────────────

  private async getSalesTrend(range: DateRange) {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        status: {
          notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED],
        },
      },
      select: {
        createdAt: true,
        total: true, // ← correct field name from schema
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by calendar date
    const byDay = new Map<string, { revenue: number; orders: number }>();

    for (const order of orders) {
      const day = order.createdAt.toISOString().split('T')[0];
      const existing = byDay.get(day) ?? { revenue: 0, orders: 0 };
      byDay.set(day, {
        revenue: existing.revenue + (order.total ?? 0),
        orders: existing.orders + 1,
      });
    }

    // Fill every day in the range so the chart line has no gaps
    const result: { date: string; revenue: number; orders: number }[] = [];
    const cursor = new Date(range.start);

    while (cursor <= range.end) {
      const key = cursor.toISOString().split('T')[0];
      const data = byDay.get(key) ?? { revenue: 0, orders: 0 };
      result.push({
        date: key.slice(5),
        revenue: data.revenue,
        orders: data.orders,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  // ── Top Products ─────────────────────────────────────────────────────────────

  private async getTopProducts(range: DateRange) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: range.start, lte: range.end },
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED] },
        },
      },
      select: {
        quantity: true,
        totalPriceAtPurchase: true, // ← correct field name
        product: {
          select: {
            id: true,
            title: true, // ← `title` not `name` in your schema
            subCategories: {
              take: 1,
              select: {
                subCategory: { select: { name: true } },
              },
            },
            // Stock: traverse Product → ProductColor → ProductSize
            colors: {
              select: {
                sizes: { select: { quantity: true } },
              },
            },
          },
        },
      },
    });

    const productMap = new Map<
      number,
      {
        id: number;
        name: string;
        category: string;
        sales: number;
        revenue: number;
        stock: number;
      }
    >();

    for (const item of items) {
      const p = item.product;
      if (!p) continue;

      // Sum all size quantities across all colors for this product
      const totalStock = p.colors
        .flatMap((c) => c.sizes)
        .reduce((sum, s) => sum + (s.quantity ?? 0), 0);

      const existing = productMap.get(p.id) ?? {
        id: p.id,
        name: p.title,
        category: p.subCategories[0]?.subCategory?.name ?? 'Uncategorized',
        sales: 0,
        revenue: 0,
        stock: totalStock,
      };

      productMap.set(p.id, {
        ...existing,
        sales: existing.sales + (item.quantity ?? 1),
        revenue: existing.revenue + (item.totalPriceAtPurchase ?? 0),
      });
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        status:
          p.stock === 0
            ? ('out_of_stock' as const)
            : p.stock <= 5
              ? ('low_stock' as const)
              : ('in_stock' as const),
      }));
  }

  // ── Recent Orders ────────────────────────────────────────────────────────────

  private async getRecentOrders() {
    const orders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        orderId: true, // ← human-readable "ORD-xxx" string, not numeric id
        total: true, // ← correct field name
        status: true,
        customerName: true, // ← stored directly on Order in your schema
        createdAt: true,
        // Payment method is on the Payment relation, not directly on Order
        payments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { method: true },
        },
      },
    });

    return orders.map((o) => ({
      id: o.orderId,
      customer: o.customerName,
      date: o.createdAt.toISOString().split('T')[0],
      amount: o.total ?? 0,
      status: o.status.toLowerCase(),
      payment: (o.payments[0]?.method ?? 'COD').toLowerCase(),
    }));
  }

  // ── Top Search Keywords ──────────────────────────────────────────────────────

  private async getTopViewedProducts(range: DateRange) {
    const views = await this.prisma.productView.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: range.start, lte: range.end },
      },
      _sum: { viewCount: true },
      orderBy: { _sum: { viewCount: 'desc' } },
      take: 10,
    });

    if (!views.length) return [];

    const productIds = views.map((v) => v.productId);

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        title: true,
        subCategories: {
          take: 1,
          select: { subCategory: { select: { name: true } } },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return views.map((v) => {
      const product = productMap.get(v.productId);
      return {
        productId: v.productId,
        title: product?.title ?? 'Unknown',
        category:
          product?.subCategories[0]?.subCategory?.name ?? 'Uncategorized',
        views: v._sum.viewCount ?? 0,
      };
    });
  }
}
