import { IsImageUrl } from '../../common/validators/is-image-url.decorator';
import {
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateFeaturedCategoryDto {
  @IsInt()
  subCategoryId!: number;

  @IsImageUrl()
  image!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
