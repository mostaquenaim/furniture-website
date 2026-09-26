import { Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';

@Module({
  providers: [ActivityLogService],
})
export class ActivityLogModule {}
