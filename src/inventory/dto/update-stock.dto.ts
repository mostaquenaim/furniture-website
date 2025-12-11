import { IsArray } from 'class-validator';

export class UpdateStockDto {
  @IsArray()
  items: {
    productId: string;
    variantId?: string;
    stock: number;
  }[];
}
