import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateHomepageGalleryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  image!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers, and hyphens only',
  })
  slug!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true) // Handles string "true" from FormData
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true) // Crucial for the new field
  isHeading?: boolean;
}
