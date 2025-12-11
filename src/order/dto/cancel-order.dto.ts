import { IsString, IsOptional } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  note?: string;
}
