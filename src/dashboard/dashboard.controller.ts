// src/dashboard/dashboard.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Query() query: DashboardQueryDto) {
    const end = query.end ?? new Date().toISOString().split('T')[0];
    const start =
      query.start ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

    return await this.dashboardService.getDashboardData(start, end);
  }
}
