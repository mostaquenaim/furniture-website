import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PromoBannerLinkDto {
  @IsString()
  text!: string;

  @IsString()
  url!: string;
}

export class CreatePromoBannerDto {
  @IsString()
  text!: string;

  @IsString()
  title!: string;

  @IsString()
  bgColor!: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromoBannerLinkDto)
  links?: PromoBannerLinkDto[];
}
