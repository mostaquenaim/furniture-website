/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('ticket')
  createTicket(@Req() req, @Body() dto: CreateSupportTicketDto) {
    return this.supportService.createTicket(req?.user?.userId, dto);
  }

  @Get('my-tickets')
  getMyTickets(@Req() req) {
    return this.supportService.getMyTickets(req?.user?.userId);
  }

  @Get('ticket/:id')
  getTicketById(@Req() req, @Param('id') id: string) {
    return this.supportService.getTicketById(+id, req?.user?.userId);
  }

  @Post('ticket/:id/reply')
  addCustomerReply(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.supportService.addCustomerReply(
      +id,
      req?.user?.userId,
      dto,
    );
  }
}
