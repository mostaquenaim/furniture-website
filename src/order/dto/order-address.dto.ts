import { IsInt, IsString } from 'class-validator';

export class OrderAddressDto {
  @IsInt()
  districtId: number;

  @IsString()
  fullAddress: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;
}
