import { IsBoolean } from 'class-validator';

export class UpdateContactMessageDto {
  @IsBoolean() handled: boolean;
}
