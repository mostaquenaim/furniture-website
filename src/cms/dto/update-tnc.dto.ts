import { PartialType } from '@nestjs/mapped-types';
import { CreateTnCDto } from './create-tnc.dto';

export class UpdateTnCDto extends PartialType(CreateTnCDto) {}
