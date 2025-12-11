import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  // Mock data
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

  private searchKeywords = [
    { keyword: 'sofa', count: 15 },
    { keyword: 'table', count: 8 },
  ];

  private retention = [
    { month: 'Nov', retainedUsers: 10 },
    { month: 'Dec', retainedUsers: 12 },
  ];

  private revenue = [
    { month: 'Nov', revenue: 5000 },
    { month: 'Dec', revenue: 6500 },
  ];

  // Sales analytics
  getSales() { return this.sales; }

  // Product analytics
  getProducts() { return this.products; }

  // User analytics
  getUsers() { return this.users; }

  // Search keyword analytics
  getSearch() { return this.searchKeywords; }

  // User retention analytics
  getRetention() { return this.retention; }

  // Revenue trends
  getRevenue() { return this.revenue; }

  // Dashboard summary
  getDashboard() {
    return {
      totalSales: this.sales.reduce((sum, s) => sum + s.total, 0),
      totalUsers: this.users.length,
      totalProducts: this.products.length,
      topKeyword: this.searchKeywords[0]?.keyword || null,
    };
  }
}
