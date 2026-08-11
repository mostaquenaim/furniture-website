// src/reservation/dto/reservation.dto.ts
import { IsEmail, IsInt, IsString } from 'class-validator';

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

export class EmailPickSlipDto {
  @IsEmail()
  email: string;
}
