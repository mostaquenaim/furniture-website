import { IsString, IsOptional, IsNumber, IsInt, IsArray } from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsInt()
  @IsOptional()
  stock?: number;

  @IsArray()
  @IsOptional()
  images?: string[];
}
