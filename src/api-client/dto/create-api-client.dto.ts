import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiScope } from '../api-scope.enum';

export class CreateApiClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ApiScope, { each: true })
  scopes: ApiScope[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6000)
  rateLimitPerMinute?: number;

  // ISO 8601 — omit for a key that never expires.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
