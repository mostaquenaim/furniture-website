import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
