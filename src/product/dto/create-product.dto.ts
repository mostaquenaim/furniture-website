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
import { CreateProductSubCategoryDto } from './CreateProductSubCategoryDto.dto';
import { CreateProductImageDto } from './CreateProductImageDto.dto';

export enum DiscountType {
  PERCENT = 'PERCENT',
  FLAT = 'FLAT',
}

export class CreateProductDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  basePrice: number;

  @IsBoolean()
  hasColorVariants: boolean;

  @IsBoolean()
  showColor: boolean;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  discountStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  discountEnd?: Date;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  deliveryEstimate?: string;

  @IsOptional()
  @IsString()
  productDetails?: string;

  @IsOptional()
  @IsString()
  dimension?: string;

  @IsOptional()
  @IsString()
  shippingReturn?: string;

  @IsBoolean()
  isActive: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  images: CreateProductImageDto[]; 

  // ✅ SubCategories
  @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => CreateProductSubCategoryDto)
  subCategories: number[];

  // ✅ Color Variants
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductColorDto)
  colors: CreateProductColorDto[];
}
