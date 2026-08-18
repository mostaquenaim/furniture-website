import { IsString } from 'class-validator';

export class SSLVerifyDto {
  @IsString()
  transactionId: string;
}
