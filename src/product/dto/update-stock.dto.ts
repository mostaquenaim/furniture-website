import { IsInt } from 'class-validator';

export class UpdateStockDto {
  @IsInt()
  stock: number;
}
