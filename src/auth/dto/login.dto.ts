import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { BD_PHONE_REGEX, BD_PHONE_MESSAGE } from 'src/common/utils/phone.utils';

export class LoginDto {
  @IsOptional()
  @Matches(BD_PHONE_REGEX, { message: BD_PHONE_MESSAGE })
  phone?: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  clientIp?: string;

  // type: string;

  @IsOptional()
  password?: string;
}
