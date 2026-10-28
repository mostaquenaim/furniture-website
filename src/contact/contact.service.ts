import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ContactMessage, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminNotificationsService } from 'src/admin-notifications/admin-notifications.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { CreateContactDto } from './dto/create-contact.dto';

// The form is public, so cap it per sender and overall: enough for real
// customers, while a script can't flood the table or the company inbox.
const PER_EMAIL_HOURLY_LIMIT = 3;
const TOTAL_HOURLY_LIMIT = 30;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private prisma: PrismaService,
    private adminNotificationsService: AdminNotificationsService,
    private notificationsService: NotificationsService,
  ) {}

  async submit(dto: CreateContactDto) {
    const since = new Date(Date.now() - 3_600_000);
    const [fromSender, total] = await Promise.all([
      this.prisma.contactMessage.count({
        where: { email: dto.email, createdAt: { gte: since } },
      }),
      this.prisma.contactMessage.count({
        where: { createdAt: { gte: since } },
      }),
    ]);
    if (fromSender >= PER_EMAIL_HOURLY_LIMIT || total >= TOTAL_HOURLY_LIMIT) {
      throw new HttpException(
        {
          statusCode: 429,
          message:
            'Too many messages right now. Please try again later or call us.',
        },
        429,
      );
    }

    const message = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        orderNumber: dto.orderNumber || null,
        subject: dto.subject,
        message: dto.message,
      },
    });

    // Staff alerts must not slow down or fail the customer's request
    void this.adminNotificationsService.notify({
      type: 'CONTACT_MESSAGE',
      title: 'New contact message',
      message: `${message.name} · ${message.subject}`,
      link: '/admin/contact-messages',
      metadata: { contactMessageId: message.id },
    });
    void this.emailCompanyInbox(message);

    return { id: message.id };
  }

  async list({
    page = 1,
    limit = 20,
    status,
  }: {
    page?: number;
    limit?: number;
    status?: 'open' | 'handled';
  }) {
    const where: Prisma.ContactMessageWhereInput =
      status === 'open'
        ? { handledAt: null }
        : status === 'handled'
          ? { handledAt: { not: null } }
          : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactMessage.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async setHandled(id: number, handled: boolean) {
    const existing = await this.prisma.contactMessage.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Message not found');

    return this.prisma.contactMessage.update({
      where: { id },
      data: { handledAt: handled ? (existing.handledAt ?? new Date()) : null },
    });
  }

  // Sent to the company email set in admin settings, with Reply-To set to
  // the customer so staff can answer straight from their inbox. Never throws.
  private async emailCompanyInbox(message: ContactMessage) {
    try {
      const company = await this.prisma.companyInfo.findUnique({
        where: { id: 1 },
        select: { email: true },
      });
      if (!company?.email) {
        this.logger.warn(
          `Contact message ${message.id} not emailed — no company email set`,
        );
        return;
      }
      await this.notificationsService.sendContactMessage(company.email, {
        name: message.name,
        email: message.email,
        orderNumber: message.orderNumber,
        subject: message.subject,
        message: message.message,
      });
    } catch (err) {
      this.logger.error(`Failed to email contact message ${message.id}`, err);
    }
  }
}
