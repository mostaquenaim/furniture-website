/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, SupportPriority, SupportStatus } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';

@Injectable()
export class AdminTicketService {
  private readonly logger = new Logger(AdminTicketService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
    private notificationsService: NotificationsService,
  ) {}

  async listTickets({
    page = 1,
    limit = 20,
    status,
    priority,
    assignedToId,
    unassigned,
    search,
  }: {
    page?: number;
    limit?: number;
    status?: SupportStatus;
    priority?: SupportPriority;
    assignedToId?: number;
    unassigned?: boolean;
    search?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: Prisma.SupportTicketWhereInput = {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(unassigned
        ? { assignedToId: null }
        : assignedToId
          ? { assignedToId }
          : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          assignedTo: { select: { name: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAssignableStaff() {
    return this.prisma.user.findMany({
      where: { role: { in: ['SUPPORT', 'SUPERADMIN'] }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  private async getTicketOrThrow(id: number) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async getTicketDetail(id: number) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { name: true, role: true } } },
        },
        user: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    return ticket;
  }

  async replyToTicket(
    ticketId: number,
    staffId: number,
    dto: CreateTicketMessageDto,
  ) {
    const ticket = await this.getTicketOrThrow(ticketId);
    const isInternalNote = dto.isInternalNote ?? false;

    const message = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorId: staffId,
        body: dto.body,
        isInternalNote,
      },
    });

    if (!isInternalNote && ticket.status === SupportStatus.OPEN) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: SupportStatus.IN_PROGRESS },
      });
    }

    this.activityLogService.log({
      adminId: staffId,
      action: 'REPLY_TICKET',
      module: 'SUPPORT',
      targetId: ticketId,
      targetLabel: ticket.subject,
    });

    if (!isInternalNote) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: ticket.userId },
          select: { email: true },
        });
        const frontendUrl = process.env.FRONTEND_URL ?? '';
        await this.notificationsService.sendTicketReplyNotification(
          { email: user?.email },
          {
            ticketId: ticket.id,
            subject: ticket.subject,
            replyPreview: dto.body,
            ticketUrl: `${frontendUrl}/support-tickets/${ticket.id}`,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to queue ticket-reply notification for ticket ${ticket.id}`,
          err,
        );
      }
    }

    return message;
  }

  async assignTicket(
    ticketId: number,
    actorStaffId: number,
    assignedToId: number,
  ) {
    const ticket = await this.getTicketOrThrow(ticketId);

    const assignee = await this.prisma.user.findUnique({
      where: { id: assignedToId },
    });
    if (
      !assignee ||
      !['SUPPORT', 'SUPERADMIN'].includes(assignee.role)
    ) {
      throw new BadRequestException(
        'Assignee must be an active SUPPORT or SUPERADMIN user',
      );
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId },
      include: {
        user: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
      },
    });

    this.activityLogService.log({
      adminId: actorStaffId,
      action: 'ASSIGN_TICKET',
      module: 'SUPPORT',
      targetId: ticketId,
      targetLabel: ticket.subject,
      oldValue: { assignedToId: ticket.assignedToId },
      newValue: { assignedToId },
    });

    return updated;
  }

  async updateStatus(
    ticketId: number,
    actorStaffId: number,
    status: SupportStatus,
  ) {
    const ticket = await this.getTicketOrThrow(ticketId);

    const data: Prisma.SupportTicketUpdateInput = { status };
    if (status === SupportStatus.RESOLVED) {
      data.resolvedAt = new Date();
    } else if (status === SupportStatus.CLOSED) {
      data.closedAt = new Date();
    } else if (
      status === SupportStatus.OPEN ||
      status === SupportStatus.IN_PROGRESS
    ) {
      data.resolvedAt = null;
      data.closedAt = null;
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data,
    });

    this.activityLogService.log({
      adminId: actorStaffId,
      action: 'UPDATE_TICKET_STATUS',
      module: 'SUPPORT',
      targetId: ticketId,
      targetLabel: ticket.subject,
      oldValue: { status: ticket.status },
      newValue: { status },
    });

    return updated;
  }

  async updatePriority(
    ticketId: number,
    actorStaffId: number,
    priority: SupportPriority,
  ) {
    const ticket = await this.getTicketOrThrow(ticketId);

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority },
    });

    this.activityLogService.log({
      adminId: actorStaffId,
      action: 'UPDATE_TICKET_PRIORITY',
      module: 'SUPPORT',
      targetId: ticketId,
      targetLabel: ticket.subject,
      oldValue: { priority: ticket.priority },
      newValue: { priority },
    });

    return updated;
  }
}
