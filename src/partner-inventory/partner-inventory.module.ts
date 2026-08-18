import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiClientModule } from 'src/api-client/api-client.module';
import { PartnerInventoryController } from './partner-inventory.controller';
import { PartnerInventoryService } from './partner-inventory.service';

@Module({
  imports: [ApiClientModule],
  controllers: [PartnerInventoryController],
  providers: [PartnerInventoryService, PrismaService],
})
export class PartnerInventoryModule {}
