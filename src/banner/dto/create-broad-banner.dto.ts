import { IsString, IsUrl, IsBoolean, IsOptional } from 'class-validator';

export class CreateBroadBannerDto {
  @IsString()
  title!: string;

  @IsUrl()
  image!: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
