import { PartialType } from '@nestjs/mapped-types';
import { CreateSeasonalCategoryDto } from './create-seasonal-category.dto';

export class UpdateSeasonalCategoryDto extends PartialType(
  CreateSeasonalCategoryDto,
) {}