import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductColorSizeDto {
  @IsNumber()
  sizeId: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsNumber()
  quantity: number;
}

export class CreateProductColorDto {
  @IsNumber()
  colorId: number;

  @IsOptional()
  @IsBoolean()
  useDefaultImages?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductColorSizeDto)
  sizes?: ProductColorSizeDto[];
}
