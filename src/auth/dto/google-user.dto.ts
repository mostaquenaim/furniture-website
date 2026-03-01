import { IsOptional, IsString } from 'class-validator';

export class GoogleUserDto {
  @IsString()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsString()
  googleId: string;
}
