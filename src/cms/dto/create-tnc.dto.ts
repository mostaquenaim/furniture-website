import { IsString } from 'class-validator';

export class CreateTnCDto {
  @IsString()
  content: string;
}
