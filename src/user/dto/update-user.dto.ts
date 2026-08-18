import { IsOptional, IsString, IsEmail, Matches } from 'class-validator';
import { BD_PHONE_REGEX, BD_PHONE_MESSAGE } from 'src/common/utils/phone.utils';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(BD_PHONE_REGEX, { message: BD_PHONE_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsString()
  otp?: string;
}
