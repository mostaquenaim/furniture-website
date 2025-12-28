import { IsInt } from 'class-validator';

export class CreateProductStockDto {
  @IsInt()
  quantity: number;
}
