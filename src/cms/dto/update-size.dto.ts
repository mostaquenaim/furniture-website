import { PartialType } from '@nestjs/mapped-types';
import { CreateSizeDto } from './create-size-dto.dto';

export class UpdateSizeDto extends PartialType(CreateSizeDto) {}
