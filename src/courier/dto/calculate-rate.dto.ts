import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CalculateRateDto {
  @IsInt()
  districtId: number;

  @IsNumber()
  weight: number;

  @IsOptional()
  @IsNumber()
  codAmount?: number;

  @IsOptional()
  @IsString()
  providerId?: number;
}
