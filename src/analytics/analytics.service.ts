import { Injectable } from '@nestjs/common';
import { DashboardService } from 'src/dashboard/dashboard.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly dashboardService: DashboardService) {}

  // Mock data — not part of this task's scope (real-data work covered only
  // "Top Searched Keywords" and "User Retention" below).
  private sales = [
    { date: '2025-12-01', total: 1000 },
    { date: '2025-12-02', total: 1500 },
  ];

  private products = [
    { id: 1, title: 'Sofa', views: 150, sold: 10 },
    { id: 2, title: 'Table', views: 120, sold: 5 },
  ];

  private users = [
    { id: 1, name: 'John', orders: 3 },
    { id: 2, name: 'Alice', orders: 2 },
  ];

  private revenue = [
    { month: 'Nov', revenue: 5000 },
    { month: 'Dec', revenue: 6500 },
  ];

  // Sales analytics
  getSales() {
    return this.sales;
  }

  // Product analytics
  getProducts() {
    return this.products;
  }

  // User analytics
  getUsers() {
    return this.users;
  }

  // Search keyword analytics — real data backed by SearchLog, defaults to
  // the trailing 30 days when no explicit range is given.
  async getSearch(start?: string, end?: string) {
    const { startStr, endStr } = this.resolveRange(start, end, 30);
    return this.dashboardService.getTopSearchKeywordsForRange(
      startStr,
      endStr,
    );
  }

  // User retention analytics — real data backed by order history, defaults
  // to the trailing 6 months when no explicit range is given.
  async getRetention(start?: string, end?: string) {
    const { startStr, endStr } = this.resolveRange(start, end, 180);
    return this.dashboardService.getUserRetentionForRange(startStr, endStr);
  }

  // Revenue trends
  getRevenue() {
    return this.revenue;
  }

  // Dashboard summary
  async getDashboard() {
    const topKeywords = await this.getSearch();

    return {
      totalSales: this.sales.reduce((sum, s) => sum + s.total, 0),
      totalUsers: this.users.length,
      totalProducts: this.products.length,
      topKeyword: topKeywords[0]?.keyword ?? null,
    };
  }

  private resolveRange(
    start: string | undefined,
    end: string | undefined,
    daysBack: number,
  ) {
    const endStr = end ?? new Date().toISOString().split('T')[0];
    const startStr =
      start ??
      new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    return { startStr, endStr };
  }
}
