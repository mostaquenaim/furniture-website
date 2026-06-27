import { PartialType } from '@nestjs/mapped-types';
import { CreateFeaturedCategoryDto } from './create-featured-category.dto';

export class UpdateFeaturedCategoryDto extends PartialType(
  CreateFeaturedCategoryDto,
) {}
