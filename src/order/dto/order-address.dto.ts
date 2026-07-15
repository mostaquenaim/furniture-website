import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class OrderAddressDto {
  @Type(() => Number)
  @IsInt()
  districtId: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  areaId?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  zoneId?: number;

  @IsString()
  @IsOptional()
  areaName?: string;

  @IsString()
  @IsOptional()
  zoneName?: string;

  @IsString()
  fullAddress: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  postCode?: string;
}
