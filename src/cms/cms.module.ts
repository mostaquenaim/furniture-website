import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [CmsController],
  providers: [CmsService, PrismaService],
})
export class CmsModule {}
