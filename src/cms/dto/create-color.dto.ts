import { IsImageUrl } from '../../common/validators/is-image-url.decorator';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateColorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  hexCode: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsImageUrl({ optional: true })
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
