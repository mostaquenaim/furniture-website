import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminNotificationsService } from 'src/admin-notifications/admin-notifications.service';
import { NotificationsService } from 'src/notifications/notifications.service';

describe('ContactService', () => {
  let service: ContactService;
  const prisma = {
    contactMessage: { count: jest.fn(), create: jest.fn() },
    companyInfo: { findUnique: jest.fn() },
  };
  const adminNotifications = { notify: jest.fn() };
  const notifications = { sendContactMessage: jest.fn() };
  const dto = {
    name: 'Rahim',
    email: 'rahim@example.com',
    subject: 'Delivery',
    message: 'When will it arrive?',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdminNotificationsService, useValue: adminNotifications },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  it('saves the message, notifies staff and emails the company inbox', async () => {
    prisma.contactMessage.count.mockResolvedValue(0);
    prisma.contactMessage.create.mockResolvedValue({
      id: 7,
      ...dto,
      orderNumber: null,
    });
    prisma.companyInfo.findUnique.mockResolvedValue({
      email: 'hello@ondorkotha.com',
    });

    await expect(service.submit(dto)).resolves.toEqual({ id: 7 });
    // let the fire-and-forget email finish
    await new Promise((resolve) => setImmediate(resolve));

    expect(adminNotifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CONTACT_MESSAGE' }),
    );
    expect(notifications.sendContactMessage).toHaveBeenCalledWith(
      'hello@ondorkotha.com',
      expect.objectContaining({ email: dto.email, orderNumber: null }),
    );
  });

  it('rejects a sender over the hourly limit without saving', async () => {
    prisma.contactMessage.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(3);

    await expect(service.submit(dto)).rejects.toMatchObject({ status: 429 });
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });
});
