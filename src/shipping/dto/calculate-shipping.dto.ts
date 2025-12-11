import { IsString, IsNumber } from 'class-validator';

export class CalculateShippingDto {
  @IsString()
  district: string;

  @IsNumber()
  weight: number;
}
