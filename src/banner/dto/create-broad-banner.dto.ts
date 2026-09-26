import { IsImageUrl } from '../../common/validators/is-image-url.decorator';
import {
  IsString,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateBroadBannerDto {
  @IsString()
  title!: string;

  @IsImageUrl()
  image!: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
