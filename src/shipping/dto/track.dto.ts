import { IsString } from 'class-validator';

export class TrackDto { @IsString() awbNumber: string; }
