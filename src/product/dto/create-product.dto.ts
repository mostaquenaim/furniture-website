import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

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

  @IsArray()
  subCategoryIds: number[];

  images: {
    image: string;
    serialNo: number;
  }[];

  colors: {
    colorId: number;
    images: string[];
    sizes: {
      sizeId: number;
      sku?: string;
      price?: number;
      stock: number;
    }[];
  }[];
}
