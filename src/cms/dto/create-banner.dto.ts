import { IsString, IsOptional } from 'class-validator';

export class CreateBannerDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  image: string;

  @IsOptional()
  @IsString()
  link?: string;
}
