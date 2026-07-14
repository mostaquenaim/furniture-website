// src/piece/piece.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PieceStatus } from '@prisma/client';
import { PieceService } from './piece.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import {
  AssignPieceLocationDto,
  GeneratePiecesDto,
  ReceiveBatchDto,
  ReceiveLookupDto,
  ReceivePieceDto,
  ReturnReceivePieceDto,
} from './dto/piece.dto';

@Controller('pieces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PieceController {
  constructor(private pieceService: PieceService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @Permission(Action.PIECE_GENERATE)
  generate(@Body() dto: GeneratePiecesDto, @Req() req: any) {
    return this.pieceService.generatePieces(
      dto,
      req?.user?.userId,
      req?.user?.role,
    );
  }

  @Get()
  @Permission(Action.PIECE_VIEW)
  getPieces(
    @Query('productSizeId') productSizeId?: string,
    @Query('status') status?: PieceStatus,
  ) {
    return this.pieceService.getPieces(
      productSizeId ? Number(productSizeId) : undefined,
      status,
    );
  }

  @Get('by-code/:barcodeValue')
  @Permission(Action.PIECE_VIEW)
  getByBarcode(@Param('barcodeValue') barcodeValue: string) {
    return this.pieceService.getByBarcode(barcodeValue);
  }

  @Get('dashboard/inventory-summary')
  @Permission(Action.PIECE_VIEW)
  getInventorySummary() {
    return this.pieceService.getInventorySummary();
  }

  @Get('dashboard/shelf-map')
  @Permission(Action.DASHBOARD_SHELF_MAP_VIEW)
  getShelfMap() {
    return this.pieceService.getShelfMap();
  }

  @Get('dashboard/damage-report')
  @Permission(Action.DASHBOARD_DAMAGE_REPORT_VIEW)
  getDamageReport(@Query('groupBy') groupBy?: string) {
    return this.pieceService.getDamageReport(
      groupBy === 'supplier' ? 'supplier' : 'type',
    );
  }

  @Post('receive/lookup')
  @Permission(Action.PIECE_RECEIVE)
  receiveLookup(@Body() dto: ReceiveLookupDto) {
    return this.pieceService.receiveLookup(dto.barcodeValue);
  }

  @Post('receive')
  @Permission(Action.PIECE_RECEIVE)
  receive(@Body() dto: ReceivePieceDto, @Req() req: any) {
    return this.pieceService.receive(
      dto,
      req?.user?.userId,
      req?.user?.role,
    );
  }

  @Post('receive/batch')
  @Permission(Action.PIECE_RECEIVE)
  receiveBatch(@Body() dto: ReceiveBatchDto, @Req() req: any) {
    return this.pieceService.receiveBatch(
      dto,
      req?.user?.userId,
      req?.user?.role,
    );
  }

  @Post('return/lookup')
  @Permission(Action.RETURN_RECEIVE_SCAN)
  returnLookup(@Body() dto: ReceiveLookupDto) {
    return this.pieceService.returnLookup(dto.barcodeValue);
  }

  @Post('return/receive')
  @Permission(Action.RETURN_RECEIVE_SCAN)
  returnReceive(@Body() dto: ReturnReceivePieceDto, @Req() req: any) {
    return this.pieceService.returnReceive(
      dto.barcodeValue,
      dto.outcome,
      req?.user?.userId,
      req?.user?.role,
    );
  }

  @Post(':barcodeValue/location')
  @Permission(Action.PIECE_LOCATION_ASSIGN)
  assignLocation(
    @Param('barcodeValue') barcodeValue: string,
    @Body() dto: AssignPieceLocationDto,
    @Req() req: any,
  ) {
    return this.pieceService.assignLocation(
      barcodeValue,
      dto,
      req?.user?.userId,
    );
  }

  @Get(':barcodeValue/image')
  @Permission(Action.PIECE_VIEW)
  async getImage(
    @Param('barcodeValue') barcodeValue: string,
    @Res() res: Response,
  ) {
    const png = await this.pieceService.generatePieceBarcodePng(barcodeValue);
    res.setHeader('Content-Type', 'image/png');
    res.end(png);
  }
}
