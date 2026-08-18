import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponDto } from './create-coupon.dto';

// All fields optional — supports full update AND partial patch (toggle status, etc.)
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}