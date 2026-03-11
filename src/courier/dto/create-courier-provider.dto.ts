import { IsString, IsBoolean, IsOptional, IsObject } from 'class-validator';

export class CreateCourierProviderDto {
  @IsString()
  name: string;

  @IsString()
  displayName: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}