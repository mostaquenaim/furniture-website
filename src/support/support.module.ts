import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [SupportController],
  providers: [SupportService, PrismaService]
})
export class SupportModule {}
