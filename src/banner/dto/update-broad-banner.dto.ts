import { PartialType } from '@nestjs/mapped-types';
import { CreateBroadBannerDto } from './create-broad-banner.dto';

export class UpdateBroadBannerDto extends PartialType(CreateBroadBannerDto) {}
