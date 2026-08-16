import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async createTicket(userId: number, dto: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        subject: dto.subject,
        message: dto.message,
        priority: dto.priority ?? 'NORMAL',
        userId,
      },
    });
  }

  // get all of my tickets, any status
  async getMyTickets(userId: number) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        subject: true,
        message: true,
        status: true,
        priority: true,
        assignedTo: { select: { name: true } },
        createdAt: true,
      },
    });
  }

  // get ticket by id
  async getTicketById(id: number, userId: number) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        messages: {
          where: { isInternalNote: false },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true, role: true } } },
        },
        assignedTo: { select: { name: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return ticket;
  }

  // customer replies on their own ticket
  async addCustomerReply(
    ticketId: number,
    userId: number,
    dto: CreateTicketMessageDto,
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    if (ticket.status === 'CLOSED') {
      throw new BadRequestException(
        'This ticket is closed — please open a new one',
      );
    }

    if (ticket.status === 'RESOLVED') {
      const [, message] = await this.prisma.$transaction([
        this.prisma.supportTicket.update({
          where: { id: ticketId },
          data: { status: 'IN_PROGRESS', resolvedAt: null },
        }),
        this.prisma.supportTicketMessage.create({
          data: {
            ticketId,
            authorId: userId,
            body: dto.body,
            isInternalNote: false,
          },
        }),
      ]);
      return message;
    }

    return this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorId: userId,
        body: dto.body,
        isInternalNote: false,
      },
    });
  }
}
