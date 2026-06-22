import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReturnRequestDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewReturnRequestDto {
  @IsEnum(ReturnRequestDecision)
  decision: ReturnRequestDecision;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
