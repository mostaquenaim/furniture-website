import { IsNumber, IsString } from 'class-validator';

export class SSLInitiateDto {
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsString()
  orderId: string;
}
