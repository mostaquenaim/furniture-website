/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CouponDiscountType } from '@prisma/client';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDate,
} from 'class-validator';

export class CreateCouponDto {
  @IsString()
  code: string;

  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  @IsNumber()
  @IsOptional()
  discountValue?: number; // percentage or fixed amount, null for free delivery

  @IsNumber()
  @IsOptional()
  minOrderValue?: number;

  @IsNumber()
  @IsOptional()
  maxDiscount?: number; // only for percentage type

  @IsDate()
  @IsOptional()
  startDate?: Date;

  @IsDate()
  expiryDate: Date;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
