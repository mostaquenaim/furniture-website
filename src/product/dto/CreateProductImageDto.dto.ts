import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateProductImageDto {
  @IsString()
  image: string;

  // @IsOptional()
  @IsInt()
  serialNo?: number;

  @IsOptional()
  @IsString()
  alt?: string;
}
