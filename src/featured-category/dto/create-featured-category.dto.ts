import {
  IsInt,
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateFeaturedCategoryDto {
  @IsInt()
  subCategoryId!: number;

  @IsUrl()
  image!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
