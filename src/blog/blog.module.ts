import { Module } from '@nestjs/common';
import { BlogsController } from './blog.controller';
import { BlogsService } from './blog.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [BlogsController],
  providers: [
    BlogsService,
    PrismaService,
    ActivityLogService,
    PermissionService,
  ],
})
export class BlogsModule {}
