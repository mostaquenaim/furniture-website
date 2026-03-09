import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
} from 'class-validator';

export class CreateCourierShipmentDto {
  @IsInt()
  orderId: number;

  @IsInt()
  providerId: number;

  @IsOptional()
  @IsString()
  consignmentId?: string;

  @IsOptional()
  @IsNumber()
  deliveryCharge?: number;

  @IsOptional()
  @IsNumber()
  codAmount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
