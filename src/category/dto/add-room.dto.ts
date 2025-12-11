import { IsInt, IsNotEmpty } from 'class-validator';

export class AddRoomDto {
  @IsInt()
  @IsNotEmpty()
  roomId: number;
}
