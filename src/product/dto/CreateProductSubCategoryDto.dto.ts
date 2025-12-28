import { IsInt } from 'class-validator';

export class CreateProductSubCategoryDto {
  @IsInt()
  subCategoryId: number;
}
