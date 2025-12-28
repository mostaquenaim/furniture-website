import { IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductSizeDto } from './CreateProductSizeDto.dto';
import { CreateProductColorImageDto } from './CreateProductColorImageDto.dto';

export class CreateProductColorDto {
  @IsInt()
  colorId: number;

  useDefaultImages: boolean;

  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => CreateProductSizeDto)
  // sizes: CreateProductSizeDto[];

  @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => CreateProductColorImageDto)
  images: string[];
}
