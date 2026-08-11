import { IsInt, Min } from 'class-validator';

export class CreateProductStockDto {
  @IsInt()
  @Min(0)
  quantity: number;
}
