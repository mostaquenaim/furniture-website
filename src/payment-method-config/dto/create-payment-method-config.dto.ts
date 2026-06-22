import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { PaymentMethod, FeeType } from '@prisma/client';

export class CreatePaymentMethodConfigDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  @MaxLength(50)
  gateway: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isSandbox?: boolean;

  @IsString()
  @MaxLength(100)
  displayName: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsEnum(FeeType)
  convenienceFeeType?: FeeType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  convenienceFeeValue?: number;

  @IsOptional()
  @IsBoolean()
  availableForCODOnly?: boolean;

  @IsOptional()
  config?: Record<string, any>;
}
