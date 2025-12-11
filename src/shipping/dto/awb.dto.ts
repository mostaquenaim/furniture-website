import { IsString } from 'class-validator';

export class AwbDto { @IsString() orderId: string; }
