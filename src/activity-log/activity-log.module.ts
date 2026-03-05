import { Module } from '@nestjs/common';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ActivityLogController],
  providers: [ActivityLogService, PrismaService]
})
export class ActivityLogModule {}
