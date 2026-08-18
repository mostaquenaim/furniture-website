import { IsInt } from 'class-validator';

export class AssignTicketDto {
  @IsInt()
  assignedToId: number;
}
