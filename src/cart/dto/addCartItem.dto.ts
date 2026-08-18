import { IsInt, IsOptional } from 'class-validator';

export class AddCartItemDto {
  @IsInt()
  productSizeId: number;

  @IsOptional()
  @IsInt()
  quantity?: number;
}
