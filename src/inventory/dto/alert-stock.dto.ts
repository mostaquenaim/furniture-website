import { IsInt } from 'class-validator';

export class AlertStockDto {
  @IsInt()
  threshold: number;
}
