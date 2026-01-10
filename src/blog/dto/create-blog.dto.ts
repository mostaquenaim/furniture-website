import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  // Blog Category
  @IsString()
  categorySlug: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  // Subcategories
  @IsOptional()
  @IsArray()
  subcategoryIds?: string[];
}
