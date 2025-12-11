import { IsString } from 'class-validator';

export class BkashExecuteDto {
  @IsString()
  paymentId: string;
}
