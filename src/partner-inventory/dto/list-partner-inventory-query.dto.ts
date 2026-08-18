import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListPartnerInventoryQueryDto {
  // The productSizeId to resume after — cursor pagination, not skip/take.
  // Offset pagination silently skips or repeats rows on a table this is
  // written to constantly by order fulfillment and stock adjustments.
  @ApiPropertyOptional({
    description: 'The `id` of the last row from the previous page.',
    example: 4821,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({
    description: 'Page size. Default 50, maximum 200.',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  // ISO 8601 — only rows changed at or after this instant are returned.
  @ApiPropertyOptional({
    description:
      'ISO 8601 timestamp — only rows changed at or after this instant are returned.',
    example: '2026-08-17T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  updatedSince?: string;

  @ApiPropertyOptional({ description: 'Exact SKU match.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string;
}
