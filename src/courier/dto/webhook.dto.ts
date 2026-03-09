import { IsObject, IsOptional, IsString } from 'class-validator';

export class CourierWebhookDto {
  @IsString()
  provider: string;

  @IsString()
  eventType: string;

  @IsObject()
  payload: Record<string, any>;

  @IsOptional()
  @IsString()
  shipmentId?: string;
}
