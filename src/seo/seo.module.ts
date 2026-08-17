import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [SeoController],
  providers: [SeoService, PrismaService, PermissionService]
})
export class SeoModule {}
