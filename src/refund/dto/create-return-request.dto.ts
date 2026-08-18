import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { RETURN_REASON_CODES } from '../constants/return-reason.constant';
import type { ReturnReasonCode } from '../constants/return-reason.constant';

export class ReturnRequestItemDto {
  @IsInt()
  orderItemId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateReturnRequestDto {
  @IsIn(RETURN_REASON_CODES)
  reason: ReturnReasonCode;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnRequestItemDto)
  items: ReturnRequestItemDto[];
}
