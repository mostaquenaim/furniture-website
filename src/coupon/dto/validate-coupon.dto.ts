import { IsString } from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  code: string;
}
