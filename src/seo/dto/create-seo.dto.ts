import { IsString, IsOptional } from 'class-validator';

export class CreateSeoDto {
  @IsString() url: string;
  @IsString() title: string;
  @IsString() description: string;
  @IsOptional() @IsString() keywords?: string;
}
