import { PartialType } from '@nestjs/mapped-types';
import { CreateUrgencyBannerDto } from './create-urgency-banner.dto';

export class UpdateUrgencyBannerDto extends PartialType(CreateUrgencyBannerDto) {}
