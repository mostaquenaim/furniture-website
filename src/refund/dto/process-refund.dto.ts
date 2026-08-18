import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ProcessRefundDto {
  /** Overrides the auto-computed refund amount (the returned items' purchase value). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
