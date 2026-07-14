// src/reservation/dto/reservation.dto.ts
import { IsInt, IsString } from 'class-validator';

export class ReservePieceDto {
  @IsInt()
  orderItemId: number;

  @IsInt()
  pieceId: number;
}

export class PickConfirmDto {
  @IsString()
  barcodeValue: string;

  @IsInt()
  shipmentGroupId: number;
}
