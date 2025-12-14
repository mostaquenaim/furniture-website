import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsOptional()
  phone: string;

  @IsOptional()
  email:string

  @IsNotEmpty()
  @IsString()
  password: string;
}
