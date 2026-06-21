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

  // Shared by every public entry point so "start"/"end" query strings are
  // interpreted the same way everywhere (end-of-day inclusive on `end`).
  private buildRange(startStr: string, endStr: string): DateRange {
    return {
      start: new Date(startStr),
      end: new Date(new Date(endStr).setHours(23, 59, 59, 999)),
    };
  }

  // ── Main entry point ─────────
  async getDashboardData(startStr: string, endStr: string) {
    const range = this.buildRange(startStr, endStr);

    const [
      stats,
      salesTrend,
      topProducts,
      recentOrders,
      topViewedProducts,
      topSearchKeywords,
      userRetention,
    ] = await Promise.all([
      this.getStats(range),
      this.getSalesTrend(range),
      this.getTopProducts(range),
      this.getRecentOrders(),
      this.getTopViewedProducts(range),
      this.getTopSearchKeywords(range),
      this.getUserRetention(range),
    ]);

    return {
      stats,
      salesTrend,
      topProducts,
      recentOrders,
      topViewedProducts,
      topSearchKeywords,
      userRetention,
    };
  }

  // ── Stats Cards ──────────
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
      totalOrders > 0
        ? parseFloat(((uniqueActiveUsers / totalOrders) * 100).toFixed(1))
        : 0;

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      activeUsers: uniqueActiveUsers,
      newUsers: newUsersInRange,
      inventoryAlerts,
      conversionRate,
    };
  }

  // ── Sales Trend ──────────────
  private async getSalesTrend(range: DateRange) {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED] },
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by calendar date
    const byDay = new Map<string, { revenue: number; orders: number }>();

    for (const order of orders) {
      const day = order.createdAt.toISOString().split('T')[0]; // "YYYY-MM-DD"
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
        date: key.slice(5), // "MM-DD"
        revenue: parseFloat(data.revenue.toFixed(2)),
        orders: data.orders,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  // ── Top Products ─────────────
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
        totalPriceAtPurchase: true,
        product: {
          select: {
            id: true,
            title: true,
            subCategories: {
              take: 1,
              select: {
                subCategory: { select: { name: true } },
              },
            },
            // Stock: Product → ProductColor → ProductSize
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

      // Sum all size quantities across all colors for this product.
      // Stock is computed once on the first encounter, then reused.
      const existing = productMap.get(p.id);

      const totalStock =
        existing?.stock ??
        p.colors
          .flatMap((c) => c.sizes)
          .reduce((sum, s) => sum + (s.quantity ?? 0), 0);

      productMap.set(p.id, {
        id: p.id,
        name: p.title,
        category: p.subCategories[0]?.subCategory?.name ?? 'Uncategorized',
        sales: (existing?.sales ?? 0) + (item.quantity ?? 1),
        revenue: (existing?.revenue ?? 0) + (item.totalPriceAtPurchase ?? 0),
        stock: totalStock,
      });
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        revenue: parseFloat(p.revenue.toFixed(2)),
        status:
          p.stock === 0
            ? ('out_of_stock' as const)
            : p.stock <= 5
              ? ('low_stock' as const)
              : ('in_stock' as const),
      }));
  }

  // ── Recent Orders ────────────
  private async getRecentOrders() {
    const orders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        orderId: true, // human-readable "ORD-xxx" string
        total: true,
        status: true,
        customerName: true, // stored directly on Order
        createdAt: true,
        // Payment method lives on the Payment relation, not on Order directly
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
      amount: parseFloat((o.total ?? 0).toFixed(2)),
      status: o.status.toLowerCase(),
      // FIX: o.payments[0]?.method is a PaymentMethod enum value (e.g. "COD",
      // "BKASH"). Falls back to "cod" if no payment record exists yet.
      payment: (o.payments[0]?.method ?? 'COD').toLowerCase(),
    }));
  }

  // ── Top Viewed Products ──────
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

  // ── Top Search Keywords ──────
  private async getTopSearchKeywords(range: DateRange) {
    const keywords = await this.prisma.searchLog.groupBy({
      by: ['keyword'],
      where: {
        createdAt: { gte: range.start, lte: range.end },
      },
      _count: { keyword: true },
      orderBy: { _count: { keyword: 'desc' } },
      take: 10,
    });

    return keywords.map((k) => ({
      keyword: k.keyword,
      count: k._count.keyword,
    }));
  }

  // ── User Retention ───────────
  private async getUserRetention(range: DateRange) {
    // Full order history up to range.end is needed (not just orders inside
    // the range) to know whether a customer active in a given month is
    // "new" (first order ever) or "returning" (ordered before that month).
    const orders = await this.prisma.order.findMany({
      where: {
        userId: { not: null },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED] },
        createdAt: { lte: range.end },
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const firstOrderMonth = new Map<number, string>();
    const monthlyActiveUsers = new Map<string, Set<number>>();

    for (const order of orders) {
      const userId = order.userId as number;
      const monthKey = order.createdAt.toISOString().slice(0, 7); // "YYYY-MM"

      if (!firstOrderMonth.has(userId)) {
        firstOrderMonth.set(userId, monthKey);
      }

      if (!monthlyActiveUsers.has(monthKey)) {
        monthlyActiveUsers.set(monthKey, new Set());
      }
      monthlyActiveUsers.get(monthKey)!.add(userId);
    }

    // Walk every calendar month between range.start and range.end in UTC
    // (matching the toISOString() bucketing above) so the graph has no gaps.
    const months: string[] = [];
    const cursor = new Date(
      Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1),
    );
    const lastMonth = new Date(
      Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1),
    );

    while (cursor <= lastMonth) {
      months.push(cursor.toISOString().slice(0, 7));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return months.map((monthKey) => {
      const activeUsers = monthlyActiveUsers.get(monthKey) ?? new Set<number>();

      let newCustomers = 0;
      let returningCustomers = 0;

      for (const userId of activeUsers) {
        if (firstOrderMonth.get(userId) === monthKey) newCustomers++;
        else returningCustomers++;
      }

      const totalActive = newCustomers + returningCustomers;
      const retentionRate =
        totalActive > 0
          ? parseFloat(((returningCustomers / totalActive) * 100).toFixed(1))
          : 0;

      const [year, month] = monthKey.split('-').map(Number);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
        'en-US',
        { month: 'short', year: 'numeric', timeZone: 'UTC' },
      );

      return {
        month: label,
        newCustomers,
        returningCustomers,
        retentionRate,
      };
    });
  }

  // Public range-based entry points so other modules (e.g. AnalyticsService)
  // can reuse this exact aggregation logic instead of re-implementing it.
  async getTopSearchKeywordsForRange(startStr: string, endStr: string) {
    return this.getTopSearchKeywords(this.buildRange(startStr, endStr));
  }

  async getUserRetentionForRange(startStr: string, endStr: string) {
    return this.getUserRetention(this.buildRange(startStr, endStr));
  }
}
