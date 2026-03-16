/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/barcode/barcode.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { BarcodeService } from './barcode.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import {
  AssignLocationDto,
  CreateBarcodeDto,
  CreateLocationDto,
  PrintLabelsDto,
  UpdateQuantityDto,
} from './dto/barcode.dto';
import { Action } from 'src/permission/action.enum';
import { Permission } from 'src/permission/permission.decorator';

@Controller('barcodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarcodeController {
  constructor(private barcodeService: BarcodeService) {}

  // ── Barcodes ──────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permission(Action.BARCODE_CREATE)
  create(@Body() dto: CreateBarcodeDto, @Req() req: any) {
    return this.barcodeService.createBarcode(dto, req?.user?.userId);
  }

  @Get()
  @Permission(Action.BARCODE_VIEW)
  getAll(@Query('lowStock') lowStock?: string) {
    return this.barcodeService.getAll(lowStock === 'true');
  }

  @Get('low-stock')
  @Permission(Action.BARCODE_VIEW)
  getLowStock() {
    return this.barcodeService.getLowStock();
  }

  @Patch(':id/location')
  @Permission(Action.BARCODE_UPDATE)
  assignLocation(@Param('id') id: string, @Body() dto: AssignLocationDto) {
    return this.barcodeService.assignLocation(id, dto);
  }

  @Patch(':id/quantity')
  @Permission(Action.BARCODE_UPDATE)
  updateQuantity(@Param('id') id: string, @Body() dto: UpdateQuantityDto) {
    return this.barcodeService.updateQuantity(id, dto.delta);
  }

  @Get('product/:productId')
  @Permission(Action.BARCODE_VIEW)
  getByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.barcodeService.getByProductId(productId);
  }

  @Post('print')
  @Permission(Action.BARCODE_VIEW)
  printLabels(@Body() dto: PrintLabelsDto, @Res() res: Response) {
    return this.barcodeService.printLabelSheet(dto.barcodeIds, res);
  }

  @Post('locations')
  @HttpCode(HttpStatus.CREATED)
  @Permission(Action.LOCATION_CREATE)
  createLocation(@Body() dto: CreateLocationDto) {
    return this.barcodeService.createLocation(dto);
  }

  @Get('locations')
  @Permission(Action.LOCATION_VIEW)
  getLocations() {
    return this.barcodeService.getLocations();
  }
}
