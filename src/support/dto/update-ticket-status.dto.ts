import { IsEnum } from 'class-validator';
import { SupportStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  @IsEnum(SupportStatus)
  status: SupportStatus;
}
