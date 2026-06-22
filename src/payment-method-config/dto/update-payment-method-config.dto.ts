import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentMethodConfigDto } from './create-payment-method-config.dto';

export class UpdatePaymentMethodConfigDto extends PartialType(
  CreatePaymentMethodConfigDto,
) {}
