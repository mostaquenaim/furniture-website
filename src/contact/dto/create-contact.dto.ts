import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateContactDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsString() message: string;
  @IsOptional() @IsString() phone?: string;
}
