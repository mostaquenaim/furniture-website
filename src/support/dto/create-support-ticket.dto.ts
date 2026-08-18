import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { SupportPriority } from '@prisma/client';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsEnum(SupportPriority)
  priority?: SupportPriority;
}
