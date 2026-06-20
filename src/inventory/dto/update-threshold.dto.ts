import { IsInt, Min } from 'class-validator';

export class UpdateThresholdDto {
  @IsInt()
  @Min(0)
  lowStockAt: number;
}
