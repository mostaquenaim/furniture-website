import { IsNotEmpty, IsString } from 'class-validator';

export class CollectRemainderDto {
  @IsString()
  @IsNotEmpty()
  collectedBy: string;
}
