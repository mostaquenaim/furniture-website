import { IsImageUrl } from '../../common/validators/is-image-url.decorator';
import {
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
  IsEnum,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType } from '../roles.enum';

export class ProductColorSizeDto {
  @IsNumber()
  sizeId: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  // Shipping weight (kg) for this size; null/omitted uses the product weight.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight?: number | null;
}

export class CreateProductColorDto {
  @IsNumber()
  colorId: number;

  @IsOptional()
  @IsBoolean()
  useDefaultImages?: boolean;

  @IsOptional()
  @IsArray()
  @IsImageUrl({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductColorSizeDto)
  sizes?: ProductColorSizeDto[];
}
