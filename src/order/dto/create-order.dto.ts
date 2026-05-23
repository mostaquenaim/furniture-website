import {
  IsInt,
  IsString,
  ValidateNested,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderAddressDto } from './order-address.dto';

export class CreateOrderDto {
  @IsInt()
  cartId: number;

  @ValidateNested()
  @Type(() => OrderAddressDto)
  address: OrderAddressDto;

  @IsInt()
  @IsOptional()
  deliveryFee?: number;

  @IsString()
  @IsIn(['COD', 'ONLINE'])
  paymentMethod: string;

  @IsString()
  @IsOptional()
  otp?: string;
}
