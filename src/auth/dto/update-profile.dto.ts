import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

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
  phone?: string;
}
