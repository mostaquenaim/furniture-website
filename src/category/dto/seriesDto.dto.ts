import { IsImageUrl } from '../../common/validators/is-image-url.decorator';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class CreateSeriesDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsImageUrl({ optional: true })
  image?: string;

  @IsOptional()
  @IsString()
  notice?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
