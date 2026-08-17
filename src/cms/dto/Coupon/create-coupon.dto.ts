import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
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

  // Total uses allowed across all customers; omit/null = unlimited.
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  usageLimit?: number;

  // Uses allowed per customer; omit/null = unlimited.
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  perUserLimit?: number;

  // Category ids this coupon is restricted to. Omit/empty = applies to
  // every category (whole cart), matching prior behaviour.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Type(() => Number)
  categoryIds?: number[];
}
