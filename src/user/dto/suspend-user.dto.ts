import { IsNotEmpty, IsInt } from 'class-validator';

export class SuspendUserDto {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsNotEmpty()
  reason: string;
}
