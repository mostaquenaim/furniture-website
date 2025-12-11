import { Controller, Get, Post, Body } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { AlertStockDto } from './dto/alert-stock.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()
  getInventory() {
    return this.service.getInventory();
  }

  @Post('update')
  updateStock(@Body() dto: UpdateStockDto) {
    return this.service.updateStock(dto);
  }

  @Post('alert')
  setLowStock(@Body() dto: AlertStockDto) {
    return this.service.setLowStockAlert(dto);
  }

  @Get('export')
  exportInventory() {
    return this.service.exportInventory();
  }
}
