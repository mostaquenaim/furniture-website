// src/company/dto/update-company.dto.ts
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  // Basic
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  favicon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsString()
  about?: string;

  @IsOptional()
  @IsString()
  privacyPolicy?: string;

  // Contact
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  googleMapUrl?: string;

  // Social
  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  youtube?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  // SEO
  @IsOptional()
  @IsString()
  @MaxLength(60)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  ogImage?: string;
}
