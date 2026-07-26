import { Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [ActivityLogService, PrismaService],
})
export class ActivityLogModule {}
