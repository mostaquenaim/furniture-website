import { PartialType } from '@nestjs/mapped-types';
import { CreateSeoDto } from './create-seo.dto';

export class UpdateSeoDto extends PartialType(CreateSeoDto) {}
