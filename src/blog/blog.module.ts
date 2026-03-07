import { Module } from '@nestjs/common';
import { BlogsController } from './blog.controller';
import { BlogsService } from './blog.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [BlogsController],
  providers: [BlogsService, PrismaService, ActivityLogService],
})
export class BlogsModule {}
