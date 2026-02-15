import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class UpdateDistrictDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  deliveryFee?: number;

  @IsOptional()
  @IsBoolean()
  isCODAvailable?: boolean;
}
