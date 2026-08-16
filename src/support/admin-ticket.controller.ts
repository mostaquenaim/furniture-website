import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminTicketService } from './admin-ticket.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Action } from 'src/permission/action.enum';
import { Permission } from 'src/permission/permission.decorator';
import { SupportPriority, SupportStatus } from '@prisma/client';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { UpdateTicketPriorityDto } from './dto/update-ticket-priority.dto';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminTicketController {
  constructor(private readonly adminTicketService: AdminTicketService) {}

  @Get()
  @Permission(Action.TICKET_VIEW)
  listTickets(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: SupportStatus,
    @Query('priority') priority?: SupportPriority,
    @Query('assignedToId') assignedToId?: string,
    @Query('unassigned') unassigned?: string,
    @Query('search') search?: string,
  ) {
    return this.adminTicketService.listTickets({
      page: Number(page),
      limit: Number(limit),
      status,
      priority,
      assignedToId: assignedToId ? Number(assignedToId) : undefined,
      unassigned: unassigned === 'true',
      search,
    });
  }

  @Get('assignable-staff')
  @Permission(Action.TICKET_ASSIGN)
  getAssignableStaff() {
    return this.adminTicketService.getAssignableStaff();
  }

  @Get(':id')
  @Permission(Action.TICKET_VIEW)
  getTicketDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminTicketService.getTicketDetail(id);
  }

  @Post(':id/reply')
  @Permission(Action.TICKET_REPLY)
  replyToTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTicketMessageDto,
    @Req() req: any,
  ) {
    return this.adminTicketService.replyToTicket(id, req?.user?.userId, dto);
  }

  @Patch(':id/assign')
  @Permission(Action.TICKET_ASSIGN)
  assignTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignTicketDto,
    @Req() req: any,
  ) {
    return this.adminTicketService.assignTicket(
      id,
      req?.user?.userId,
      dto.assignedToId,
    );
  }

  @Patch(':id/status')
  @Permission(Action.TICKET_MANAGE)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
    @Req() req: any,
  ) {
    return this.adminTicketService.updateStatus(
      id,
      req?.user?.userId,
      dto.status,
    );
  }

  @Patch(':id/priority')
  @Permission(Action.TICKET_MANAGE)
  updatePriority(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketPriorityDto,
    @Req() req: any,
  ) {
    return this.adminTicketService.updatePriority(
      id,
      req?.user?.userId,
      dto.priority,
    );
  }
}
