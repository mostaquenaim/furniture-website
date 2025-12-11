import { IsString } from 'class-validator';

export class LabelDto { @IsString() awbNumber: string; }