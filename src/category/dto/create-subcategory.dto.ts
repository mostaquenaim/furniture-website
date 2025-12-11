import { IsString, IsNotEmpty, IsInt } from 'class-validator';

export class CreateSubcategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsInt()
  categoryId: number;
}
