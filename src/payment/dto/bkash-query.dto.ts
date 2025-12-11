import { IsString } from 'class-validator';

export class BkashQueryDto {
  @IsString()
  paymentId: string;
}
