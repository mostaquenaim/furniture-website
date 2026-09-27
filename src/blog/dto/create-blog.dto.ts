import { IsImageUrl } from '../../common/validators/is-image-url.decorator';
import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsInt,
} from 'class-validator';

export class CreateBlogDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  content: string;

  @IsImageUrl({ optional: true })
  image?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  // Blog Category
  @IsInt()
  blogCategoryId: number;

  // Subcategories
  @IsOptional()
  @IsArray()
  selectedSubCategoryIds?: string[];
}
