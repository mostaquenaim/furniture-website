// src/dashboard/dashboard.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Top searched keywords for the given date range.
   * Used by the admin Featured-Categories page to decide which 6 tiles to curate.
   * GET /dashboard/top-searches?start=2026-01-01&end=2026-06-27&limit=20
   */
  @Get('top-searches')
  getTopSearches(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    const todayStr = new Date().toISOString().split('T')[0];
    const resolvedEnd = end ?? todayStr;
    const resolvedStart =
      start ??
      new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    return this.dashboardService.getTopSearchKeywordsForRange(
      resolvedStart,
      resolvedEnd,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get()
  async getDashboard(@Query() query: DashboardQueryDto) {
    const todayStr = new Date().toISOString().split('T')[0];
    let start: string;
    let end: string = todayStr;

    if (query.period === 'day') {
      start = todayStr;
    } else if (query.period === 'week') {
      start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    } else if (query.period === 'month') {
      start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    } else {
      end = query.end ?? todayStr;
      start =
        query.start ??
        new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
    }

    return await this.dashboardService.getDashboardData(start, end, query.period);
  }
}
