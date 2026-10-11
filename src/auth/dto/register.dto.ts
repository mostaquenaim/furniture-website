import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { BD_PHONE_REGEX, BD_PHONE_MESSAGE } from 'src/common/utils/phone.utils';

export class RegisterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  @IsString()
  @Matches(BD_PHONE_REGEX, { message: BD_PHONE_MESSAGE })
  phone!: string;

  // A blank email means "no email": @IsOptional only skips null/undefined
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
