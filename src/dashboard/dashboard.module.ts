import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
})
export class DashboardModule {}
