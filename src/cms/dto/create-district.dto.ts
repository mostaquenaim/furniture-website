import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class CreateDistrictDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  deliveryFee?: number;

  @IsOptional()
  @IsBoolean()
  isCODAvailable?: boolean;
}
