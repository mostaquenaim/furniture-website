import { IsImageUrl } from '../../common/validators/is-image-url.decorator';
import {
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProductImageDto {
  @IsImageUrl()
  image: string;

  // @IsOptional()
  @IsInt()
  serialNo?: number;

  @IsOptional()
  @IsString()
  alt?: string;
}
