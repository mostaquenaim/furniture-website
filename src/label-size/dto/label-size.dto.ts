// src/label-size/dto/label-size.dto.ts
import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateLabelSizeDto {
  @IsString()
  name: string;

  @IsNumber()
  @IsPositive()
  widthMm: number;

  @IsNumber()
  @IsPositive()
  heightMm: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateLabelSizeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  widthMm?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  heightMm?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
