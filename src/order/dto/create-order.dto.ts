import { IsInt, IsString, ValidateNested, IsIn } from 'class-validator';
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
}
