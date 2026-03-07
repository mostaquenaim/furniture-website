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

@Controller('barcodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarcodeController {
  constructor(private barcodeService: BarcodeService) {}

  // ── Barcodes ──────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBarcodeDto, @Req() req: any) {
    return this.barcodeService.createBarcode(dto, req?.user?.userId);
  }

  @Get()
  getAll(@Query('lowStock') lowStock?: string) {
    return this.barcodeService.getAll(lowStock === 'true');
  }

  @Get('low-stock')
  getLowStock() {
    return this.barcodeService.getLowStock();
  }

  @Patch(':id/location')
  assignLocation(@Param('id') id: string, @Body() dto: AssignLocationDto) {
    return this.barcodeService.assignLocation(id, dto);
  }

  @Patch(':id/quantity')
  updateQuantity(@Param('id') id: string, @Body() dto: UpdateQuantityDto) {
    return this.barcodeService.updateQuantity(id, dto.delta);
  }

  // ── Barcode images ────────────────────────────────────────────────────────

  // @Get(':id/image')
  // streamImage(@Param('id') id: string, @Res() res: Response) {
  //   console.log('here image');
  //   return this.barcodeService.streamBarcodeImage(id, res);
  // }

  @Get('product/:productId')
  getByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.barcodeService.getByProductId(productId);
  }

  // ── Label printing ────────────────────────────────────────────────────────

  @Post('print')
  printLabels(@Body() dto: PrintLabelsDto, @Res() res: Response) {
    return this.barcodeService.printLabelSheet(dto.barcodeIds, res);
  }

  // ── Locations ─────────────────────────────────────────────────────────────

  @Post('locations')
  @HttpCode(HttpStatus.CREATED)
  createLocation(@Body() dto: CreateLocationDto) {
    return this.barcodeService.createLocation(dto);
  }

  @Get('locations')
  getLocations() {
    return this.barcodeService.getLocations();
  }
}
