import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StockAdjustReason } from '@prisma/client';

export class AdjustStockDto {
  // Negative = decrement, positive = increment.
  @IsInt()
  delta: number;

  @IsEnum(StockAdjustReason)
  reason: StockAdjustReason;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
