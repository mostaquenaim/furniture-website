/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/barcode/dto/create-barcode.dto.ts
import {
  IsOptional,
  IsString,
  IsEnum,
  Min,
  IsArray,
  IsInt,
} from 'class-validator';
import { BarcodeType } from '@prisma/client';

export class CreateBarcodeDto {
  @IsInt()
  productId: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsEnum(BarcodeType)
  barcodeType?: BarcodeType;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockAt?: number;
}

export class AssignLocationDto {
  @IsString()
  locationId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;
}

export class CreateLocationDto {
  @IsString()
  zone: string;

  @IsString()
  aisle: string;

  @IsString()
  shelf: string;

  @IsString()
  bin: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class PrintLabelsDto {
  @IsArray()
  @IsString({ each: true })
  barcodeIds: string[];
}

export class UpdateQuantityDto {
  @IsInt()
  delta: number; // positive = add, negative = remove
}
