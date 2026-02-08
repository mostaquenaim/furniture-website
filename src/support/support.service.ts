import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
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

  // get my active tickets
  async getMyTickets(userId: number) {
    return this.prisma.supportTicket.findMany({
      where: {
        userId,
        status: {
          in: ['OPEN', 'IN_PROGRESS'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
  }

  // get ticket by id
  async getTicketById(id: number, userId: number) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return ticket;
  }
}
