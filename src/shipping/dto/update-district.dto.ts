import { IsString, IsNumber } from 'class-validator';

export class UpdateDistrictDto {
  @IsString()
  name: string;

  @IsNumber()
  charge: number;
}
