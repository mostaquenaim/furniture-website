// create-banner.dto.ts
import { IsString, IsUrl, IsBoolean, IsOptional, IsInt } from 'class-validator';

export class CreateBroadBannerDto {
  @IsString()
  title!: string;

  @IsUrl()
  image!: string;

  @IsOptional()
  link?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
