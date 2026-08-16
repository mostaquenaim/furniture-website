import { IsEnum } from 'class-validator';
import { SupportPriority } from '@prisma/client';

export class UpdateTicketPriorityDto {
  @IsEnum(SupportPriority)
  priority: SupportPriority;
}
