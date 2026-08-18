/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/barcode/dto/create-barcode.dto.ts
import {
  IsOptional,
  IsString,
  IsEnum,
  Min,
  IsArray,
  IsInt,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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
  @IsOptional()
  @IsString()
  locationId!: string | null;

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

export class PrintLabelItemDto {
  @IsString()
  barcodeId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  labelQty?: number;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsDateString()
  packingDate?: string;
}

export class PrintLabelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintLabelItemDto)
  items: PrintLabelItemDto[];
}

export class UpdateQuantityDto {
  @IsInt()
  delta: number; // positive = add, negative = remove
}
