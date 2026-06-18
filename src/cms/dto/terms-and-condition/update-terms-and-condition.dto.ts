import { PartialType } from '@nestjs/mapped-types';
import { CreateTermsAndConditionDto } from './create-terms-and-condition.dto';

// All fields optional — supports full update AND partial patch (toggle status, reorder, etc.)
export class UpdateTermsAndConditionDto extends PartialType(
  CreateTermsAndConditionDto,
) {}
