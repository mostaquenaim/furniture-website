import { Module } from '@nestjs/common';
import { ApiClientModule } from 'src/api-client/api-client.module';
import { PartnerInventoryController } from './partner-inventory.controller';
import { PartnerInventoryService } from './partner-inventory.service';

@Module({
  imports: [ApiClientModule],
  controllers: [PartnerInventoryController],
  providers: [PartnerInventoryService],
})
export class PartnerInventoryModule {}
