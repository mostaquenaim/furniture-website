/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { LowStockAlertService } from './low-stock-alert.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { UpdateThresholdDto } from './dto/update-threshold.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly lowStockAlertService: LowStockAlertService,
  ) {}

  @Get()
  @Permission(Action.INVENTORY_VIEW)
  getInventory(
    @Query('search') search?: string,
    @Query('onlyLowStock') onlyLowStock?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.service.getInventory({
      search,
      onlyLowStock: onlyLowStock === 'true',
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('low-stock')
  @Permission(Action.INVENTORY_VIEW)
  getLowStockSummary() {
    return this.service.getLowStockSummary();
  }

  /** Lets an admin fire the daily digest on demand instead of waiting for the 8am cron. */
  @Post('low-stock/notify')
  @Permission(Action.INVENTORY_MANAGE)
  async triggerLowStockAlert() {
    await this.lowStockAlertService.run();
    return { triggered: true };
  }

  @Get('export')
  @Permission(Action.INVENTORY_VIEW)
  exportInventory() {
    return this.service.exportInventory();
  }

  @Get(':productSizeId/history')
  @Permission(Action.INVENTORY_VIEW)
  getStockHistory(@Param('productSizeId', ParseIntPipe) productSizeId: number) {
    return this.service.getStockHistory(productSizeId);
  }

  @Post(':productSizeId/adjust')
  @Permission(Action.INVENTORY_MANAGE)
  adjustStock(
    @Param('productSizeId', ParseIntPipe) productSizeId: number,
    @Body() dto: AdjustStockDto,
    @Req() req: any,
  ) {
    return this.service.adjustStock(productSizeId, dto, req?.user?.userId);
  }

  @Patch(':productSizeId/threshold')
  @Permission(Action.INVENTORY_MANAGE)
  updateThreshold(
    @Param('productSizeId', ParseIntPipe) productSizeId: number,
    @Body() dto: UpdateThresholdDto,
    @Req() req: any,
  ) {
    return this.service.updateThreshold(productSizeId, dto, req?.user?.userId);
  }
}
