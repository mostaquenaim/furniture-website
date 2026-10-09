import { ArrayMinSize, ArrayUnique, IsArray, IsInt } from 'class-validator';

// Section ids in their new display order; sortOrder becomes the array index.
export class ReorderTermsAndConditionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  ids!: number[];
}
