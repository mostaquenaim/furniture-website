import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class DirectRefundDto {
  @IsString()
  @MinLength(3)
  reason: string;

  /** Overrides the auto-computed refund amount (the payment's full refundable balance). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
