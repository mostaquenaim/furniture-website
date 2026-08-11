import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BD_PHONE_REGEX, BD_PHONE_MESSAGE } from 'src/common/utils/phone.utils';

// Only fields a user may edit about their own profile. Deliberately excludes
// role/isActive/password/id — those must never be settable through this DTO
// (see PUT /auth/profile mass-assignment fix).
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(BD_PHONE_REGEX, { message: BD_PHONE_MESSAGE })
  phone?: string;
}
