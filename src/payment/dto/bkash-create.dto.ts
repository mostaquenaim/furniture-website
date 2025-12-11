import { IsNumber, IsString } from 'class-validator';

export class BkashCreateDto {
  @IsNumber()
  amount: number;

  @IsString()
  orderId: string;
}
