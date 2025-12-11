import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('sales') getSales() { return this.service.getSales(); }
  @Get('products') getProducts() { return this.service.getProducts(); }
  @Get('users') getUsers() { return this.service.getUsers(); }
  @Get('search') getSearch() { return this.service.getSearch(); }
  @Get('retention') getRetention() { return this.service.getRetention(); }
  @Get('revenue') getRevenue() { return this.service.getRevenue(); }
  @Get('dashboard') getDashboard() { return this.service.getDashboard(); }
}
