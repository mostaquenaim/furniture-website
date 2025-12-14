import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

class PromoBannerLinkDto {
  @IsString()
  text: string;

  @IsString()
  url: string;
}

export class CreatePromoBannerDto {
  @IsString()
  text: string;

  @IsString()
  bgColor: string;

  @IsOptional()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  links: PromoBannerLinkDto[];
}
