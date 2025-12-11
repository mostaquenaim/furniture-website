import { IsArray, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  userId: number;

  @IsArray()
  items: { productId: number; variantId?: number; quantity: number; price: number }[];

  @IsString()
  paymentMethod: string;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsString()
  address?: string;
}
