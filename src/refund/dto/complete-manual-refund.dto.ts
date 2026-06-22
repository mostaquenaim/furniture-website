import { IsOptional, IsString } from 'class-validator';

export class CompleteManualRefundDto {
  /** e.g. bKash send-money transaction ID, bank transfer reference, cash voucher number. */
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
