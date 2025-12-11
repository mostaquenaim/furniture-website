import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  basePrice: number;

@IsNumber()
  stock: number = 0; // default here

  @IsInt()
  subcategoryId: number;

  @IsArray()
  @IsOptional()
  images?: string[];
}
