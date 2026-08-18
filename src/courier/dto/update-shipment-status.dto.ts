import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateShipmentStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  providerStatus?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
