import {
  IsInt,
  IsString,
  ValidateNested,
  IsIn,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderAddressDto } from './order-address.dto';

export class CreateOrderDto {
  @IsInt()
  cartId: number;

  @ValidateNested()
  @Type(() => OrderAddressDto)
  address: OrderAddressDto;

  @IsString()
  @IsIn(['COD', 'ONLINE'])
  paymentMethod: string;

  @IsString()
  @IsOptional()
  otp?: string;

  // The delivery fee the customer was shown at checkout (before any
  // free-delivery coupon). If the server-computed fee differs, the order is
  // rejected with DELIVERY_FEE_CHANGED instead of charging a surprise amount.
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  expectedDeliveryFee?: number;
}
