import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export enum SupportPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
}

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
