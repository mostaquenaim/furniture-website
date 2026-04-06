// src/dashboard/dto/dashboard-query.dto.ts
import { IsDateString, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;
}
