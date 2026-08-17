import { Module } from '@nestjs/common';
import { HomepageGalleryController } from './homepage-gallery.controller';
import { HomepageGalleryService } from './homepage-gallery.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [HomepageGalleryController],
  providers: [HomepageGalleryService, PrismaService, PermissionService, ActivityLogService],
})
export class HomepageGalleryModule {}
