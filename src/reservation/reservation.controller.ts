// src/reservation/reservation.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import {
  EmailPickSlipDto,
  PickConfirmDto,
  ReservePieceDto,
} from './dto/reservation.dto';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationController {
  constructor(private reservationService: ReservationService) {}

  @Get('available-pieces')
  @Permission(Action.RESERVATION_MANAGE)
  getAvailablePieces(@Query('productSizeId', ParseIntPipe) productSizeId: number) {
    return this.reservationService.getAvailablePieces(productSizeId);
  }

  @Post('orders/:orderId/reserve')
  @Permission(Action.RESERVATION_MANAGE)
  reserve(
    @Param('orderId') orderId: string,
    @Body() dto: ReservePieceDto,
    @Req() req: any,
  ) {
    return this.reservationService.reserve(
      orderId,
      dto,
      req?.user?.userId,
      req?.user?.role,
    );
  }

  @Delete(':reservationId')
  @Permission(Action.RESERVATION_MANAGE)
  release(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @Req() req: any,
  ) {
    return this.reservationService.release(reservationId, req?.user?.userId);
  }

  @Get('orders/:orderId/pick-slip')
  @Permission(Action.PICK_SLIP_VIEW)
  getPickSlip(@Param('orderId') orderId: string) {
    return this.reservationService.getPickSlip(orderId);
  }

  @Post('orders/:orderId/pick-slip/email')
  @Permission(Action.PICK_SLIP_VIEW)
  emailPickSlip(
    @Param('orderId') orderId: string,
    @Body() dto: EmailPickSlipDto,
  ) {
    return this.reservationService.emailPickSlip(orderId, dto.email);
  }

  @Get('orders/:orderId/shipment-group')
  @Permission(Action.PICK_SLIP_VIEW)
  getShipmentGroupStatus(@Param('orderId') orderId: string) {
    return this.reservationService.getShipmentGroupStatus(orderId);
  }

  @Post('pick-confirm')
  @Permission(Action.RESERVATION_PICK_CONFIRM)
  pickConfirm(@Body() dto: PickConfirmDto, @Req() req: any) {
    return this.reservationService.pickConfirm(
      dto.barcodeValue,
      dto.shipmentGroupId,
      req?.user?.userId,
      req?.user?.role,
    );
  }
}
