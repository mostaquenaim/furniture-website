import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from 'src/api-client/guards/api-key.guard';
import { ApiScopeGuard } from 'src/api-client/guards/api-scope.guard';
import { ApiRateLimitGuard } from 'src/api-client/guards/api-rate-limit.guard';
import { ApiUsageLogInterceptor } from 'src/api-client/interceptors/api-usage-log.interceptor';
import { RequireScope } from 'src/api-client/decorators/require-scope.decorator';
import { ApiScope } from 'src/api-client/api-scope.enum';
import { PartnerInventoryService } from './partner-inventory.service';
import { ListPartnerInventoryQueryDto } from './dto/list-partner-inventory-query.dto';
import { PartnerExceptionFilter } from './filters/partner-exception.filter';

// Deliberately a separate controller/base path from InventoryController
// (`/inventory`), not a shared one with mixed guards — a partner credential
// and a staff JWT are different identity shapes, and mixing them on one
// controller invites exactly the kind of guard-ordering bug this split
// avoids entirely.
@ApiTags('Partner Inventory')
@ApiSecurity('ApiKeyAuth')
@Controller('partner/inventory')
@UseGuards(ApiKeyGuard, ApiScopeGuard, ApiRateLimitGuard)
@UseInterceptors(ApiUsageLogInterceptor)
@UseFilters(PartnerExceptionFilter)
@RequireScope(ApiScope.INVENTORY_READ)
export class PartnerInventoryController {
  constructor(private readonly service: PartnerInventoryService) {}

  @Get()
  @ApiOperation({
    summary: 'List current stock',
    description: 'Cursor-paginated. Use `updatedSince` for incremental sync.',
  })
  list(@Query() query: ListPartnerInventoryQueryDto) {
    return this.service.list(query);
  }

  // Must be declared before the `:id` route below — otherwise Nest would
  // try to match "low-stock" as an :id and fail it with ParseIntPipe.
  @Get('low-stock')
  @ApiOperation({ summary: 'List items at or below their low-stock threshold' })
  lowStock(@Query() query: ListPartnerInventoryQueryDto) {
    return this.service.listLowStock(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single stock row by its id' })
  @ApiParam({ name: 'id', example: 4821 })
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }
}
