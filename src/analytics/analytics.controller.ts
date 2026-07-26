import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Permission(Action.ANALYTICS_VIEW)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('sales') getSales() { return this.service.getSales(); }
  @Get('products') getProducts() { return this.service.getProducts(); }
  @Get('users') getUsers() { return this.service.getUsers(); }

  @Get('search')
  getSearch(@Query('start') start?: string, @Query('end') end?: string) {
    return this.service.getSearch(start, end);
  }

  @Get('retention')
  getRetention(@Query('start') start?: string, @Query('end') end?: string) {
    return this.service.getRetention(start, end);
  }

  @Get('revenue') getRevenue() { return this.service.getRevenue(); }
  @Get('dashboard') getDashboard() { return this.service.getDashboard(); }
}
