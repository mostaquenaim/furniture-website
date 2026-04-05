import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CouponDiscountType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_-]{3,20}$/i, {
    message: 'code must be 3–20 alphanumeric characters (A-Z, 0-9, _, -)',
  })
  code: string;

  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(100, { message: 'Percentage discount cannot exceed 100' })
  discountValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  maxDiscount?: number;

  @IsDateString()
  expiryDate: Date;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
