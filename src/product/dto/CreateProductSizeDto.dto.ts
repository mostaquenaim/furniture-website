import {
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductStockDto } from './CreateProductStockDto.dto';

export class CreateProductSizeDto {
  @IsInt()
  sizeId: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @ValidateNested()
  @Type(() => CreateProductStockDto)
  stock: CreateProductStockDto;
}
