import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  ValidateNested,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductColorDto } from './CreateProductColorDto.dto';
import { CreateProductImageDto } from './CreateProductImageDto.dto';
import { DiscountType } from '../roles.enum';

export class CreateProductDto {
  @IsNumber()
  basePrice: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductColorDto)
  colors: CreateProductColorDto[];

  @IsOptional()
  @IsString()
  deliveryEstimate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dimension?: string;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  discountEnd?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  discountStart?: Date;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsBoolean()
  hasColorVariants: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images: CreateProductImageDto[];

  @IsBoolean()
  isActive: boolean;

  @IsOptional()
  @IsNumber()
  materialId?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  productDetails?: string;

  @IsBoolean()
  showColor: boolean;

  @IsOptional()
  @IsString()
  shippingReturn?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  slug: string;

  @IsArray()
  subCategories: number[];

  @IsString()
  title: string;
}
