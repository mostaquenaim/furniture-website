import { PartialType } from '@nestjs/mapped-types';
import { CreateCourierProviderDto } from './create-courier-provider.dto';

export class UpdateCourierProviderDto extends PartialType(
  CreateCourierProviderDto,
) {}
