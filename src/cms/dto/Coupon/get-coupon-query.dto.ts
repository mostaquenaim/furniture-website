import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CouponDiscountType } from '@prisma/client';

export class GetCouponsQueryDto {
  // Filter by active status — omit to get all
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  isActive?: boolean;

  // Filter by discount type
  @IsOptional()
  @IsEnum(CouponDiscountType)
  discountType?: CouponDiscountType;

  // Filter by expired / not expired
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  includeExpired?: boolean;

  // Search by code (partial match)
  @IsOptional()
  @IsString()
  search?: string;
}