import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: MailerService, useValue: { sendMail: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getQueueToken('notification'), useValue: queue },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendStatusUpdate', () => {
    const order = {
      orderId: 'ORD-1',
      customerName: 'Jane',
      status: 'SHIPPED',
    };

    it('queues both email and SMS when both contact fields are present', async () => {
      await service.sendStatusUpdate(
        { email: 'jane@example.com', phone: '+8801XXXXXXXXX' },
        order,
      );

      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith(
        'sendEmail',
        expect.objectContaining({ email: 'jane@example.com' }),
      );
      expect(queue.add).toHaveBeenCalledWith(
        'sendSMS',
        expect.objectContaining({ phone: '+8801XXXXXXXXX' }),
      );
    });

    it('skips the email job when there is no email on file', async () => {
      await service.sendStatusUpdate({ phone: '+8801XXXXXXXXX' }, order);

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith('sendSMS', expect.anything());
    });

    it('skips the SMS job when there is no phone on file', async () => {
      await service.sendStatusUpdate({ email: 'jane@example.com' }, order);

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith('sendEmail', expect.anything());
    });

    it('queues nothing and does not throw when neither contact field is on file', async () => {
      await expect(
        service.sendStatusUpdate({}, order),
      ).resolves.toBeUndefined();

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('humanizes the status enum for the customer-facing subject and message', async () => {
      await service.sendStatusUpdate(
        { email: 'jane@example.com', phone: '+8801XXXXXXXXX' },
        { ...order, status: 'PARTIALLY_DELIVERED' },
      );

      const emailJob = queue.add.mock.calls.find(
        (call: unknown[]) => call[0] === 'sendEmail',
      ) as [string, { subject: string; context: { status: string } }];
      const smsJob = queue.add.mock.calls.find(
        (call: unknown[]) => call[0] === 'sendSMS',
      ) as [string, { message: string }];

      expect(emailJob[1].subject).toContain('Partially Delivered');
      expect(emailJob[1].context.status).toBe('Partially Delivered');
      expect(smsJob[1].message).toContain('Partially Delivered');
    });
  });
});
