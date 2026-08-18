import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  image!: string;

  @IsOptional()
  @IsUrl()
  link?: string;

  @IsOptional()
  @IsIn(['DESKTOP', 'MOBILE'])
  device?: 'DESKTOP' | 'MOBILE';

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
