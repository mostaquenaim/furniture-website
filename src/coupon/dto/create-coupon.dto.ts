import { IsString, IsInt, IsOptional, IsDateString } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsInt()
  discount: number; // percentage or amount

  @IsOptional()
  @IsString()
  type?: 'percent' | 'amount';

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsInt()
  usageLimit?: number;
}
