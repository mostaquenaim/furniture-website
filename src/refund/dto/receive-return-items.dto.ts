import { IsOptional, IsString } from 'class-validator';

export class ReceiveReturnItemsDto {
  @IsOptional()
  @IsString()
  adminNote?: string;
}
