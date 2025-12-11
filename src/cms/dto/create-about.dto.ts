import { IsString } from 'class-validator';

export class CreateAboutDto {
  @IsString()
  content: string;
}
