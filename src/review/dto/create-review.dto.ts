import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateReviewDto {
  @IsOptional()
  productId?: number;

  @IsString()
  comment: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
