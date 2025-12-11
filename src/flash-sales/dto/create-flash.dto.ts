import { IsString, IsArray, IsDateString } from 'class-validator';

export class CreateFlashSaleDto {
  @IsString()
  title: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsArray()
  products: string[]; // product IDs
}
