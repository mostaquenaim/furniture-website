import { IsOptional, IsString, IsUrl } from 'class-validator';

export class SendOfferDto {
  @IsString()
  subject: string;

  @IsString()
  heading: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsUrl()
  ctaUrl?: string;
}
