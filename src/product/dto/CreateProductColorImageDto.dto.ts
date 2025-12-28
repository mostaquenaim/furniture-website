import { IsString } from 'class-validator';

export class CreateProductColorImageDto {
  @IsString()
  image: string;
}
