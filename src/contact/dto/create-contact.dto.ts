import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateContactDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(200)
  email: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderNumber?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) subject: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(5000) message: string;
}
