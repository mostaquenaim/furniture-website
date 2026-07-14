// src/piece/dto/piece.dto.ts
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum ReceiveOutcome {
  GOOD = 'GOOD',
  DAMAGED = 'DAMAGED',
}

export class GeneratePiecesDto {
  @IsInt()
  productSizeId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class ReceiveLookupDto {
  @IsString()
  barcodeValue: string;
}

export class ReceivePieceDto {
  @IsString()
  barcodeValue: string;

  @IsOptional()
  @IsInt()
  supplierId?: number;

  @IsEnum(ReceiveOutcome)
  outcome: ReceiveOutcome;
}

export class ReceiveBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  barcodeValues: string[];

  @IsOptional()
  @IsInt()
  supplierId?: number;

  @IsEnum(ReceiveOutcome)
  outcome: ReceiveOutcome;
}

export class AssignPieceLocationDto {
  @IsOptional()
  @IsString()
  locationId!: string | null;
}

export class ReturnReceivePieceDto {
  @IsString()
  barcodeValue: string;

  @IsEnum(ReceiveOutcome)
  outcome: ReceiveOutcome;
}
