import { PartialType } from '@nestjs/mapped-types';
import { CreateHomepageGalleryDto } from './create-homepage-gallery.dto';

export class UpdateHomepageGalleryDto extends PartialType(
  CreateHomepageGalleryDto,
) {}
