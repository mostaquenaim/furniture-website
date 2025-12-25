import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateColorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  hexCode: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
