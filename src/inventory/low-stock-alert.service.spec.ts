/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotificationsService,
  LowStockAlertItem,
} from 'src/notifications/notifications.service';
import { InventoryService } from './inventory.service';
import { LowStockAlertService } from './low-stock-alert.service';

type SendLowStockAlertArgs = [
  string[],
  {
    outOfStock: LowStockAlertItem[];
    lowStock: LowStockAlertItem[];
    generatedAt: Date;
  },
];

describe('LowStockAlertService', () => {
  let service: LowStockAlertService;
  let inventoryService: { getLowStockSummary: jest.Mock };
  let notificationsService: { sendLowStockAlert: jest.Mock };
  let prisma: {
    rolePermission: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    inventoryService = { getLowStockSummary: jest.fn() };
    notificationsService = { sendLowStockAlert: jest.fn() };
    prisma = {
      rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LowStockAlertService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryService, useValue: inventoryService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<LowStockAlertService>(LowStockAlertService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does nothing when no items are below threshold', async () => {
    inventoryService.getLowStockSummary.mockResolvedValue({ items: [] });

    await service.run();

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(notificationsService.sendLowStockAlert).not.toHaveBeenCalled();
  });

  it('skips sending when no admin currently has INVENTORY_VIEW', async () => {
    inventoryService.getLowStockSummary.mockResolvedValue({
      items: [
        {
          quantity: 0,
          lowStockAt: 5,
          size: 'M',
          color: 'Red',
          sku: 'SKU-1',
          product: { title: 'Chair', sku: null },
        },
      ],
    });
    prisma.user.findMany.mockResolvedValue([]);

    await service.run();

    expect(notificationsService.sendLowStockAlert).not.toHaveBeenCalled();
  });

  it('splits items into out-of-stock/low-stock and emails the resolved recipients', async () => {
    inventoryService.getLowStockSummary.mockResolvedValue({
      items: [
        {
          quantity: 0,
          lowStockAt: 5,
          size: 'M',
          color: 'Red',
          sku: 'SKU-1',
          product: { title: 'Chair', sku: null },
        },
        {
          quantity: 3,
          lowStockAt: 5,
          size: 'L',
          color: 'Blue',
          sku: null,
          product: { title: 'Sofa', sku: 'SOFA-9' },
        },
      ],
    });
    prisma.rolePermission.findMany.mockResolvedValue([
      { role: UserRole.PRODUCTMANAGER },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { email: 'super@sakigai.com' },
      { email: 'pm@sakigai.com' },
    ]);

    await service.run();

    const findManyCallArgs: unknown[] = prisma.user.findMany.mock.calls[0];
    const findManyArgs = findManyCallArgs[0] as {
      where: { role: { in: UserRole[] } };
    };
    expect(findManyArgs.where.role.in).toContain(UserRole.SUPERADMIN);
    expect(findManyArgs.where.role.in).toContain(UserRole.PRODUCTMANAGER);

    expect(notificationsService.sendLowStockAlert).toHaveBeenCalledTimes(1);
    const call = notificationsService.sendLowStockAlert.mock
      .calls[0] as SendLowStockAlertArgs;
    const [recipients, payload] = call;
    expect(recipients).toEqual(['super@sakigai.com', 'pm@sakigai.com']);
    expect(payload.outOfStock).toEqual([
      {
        productTitle: 'Chair',
        sku: 'SKU-1',
        size: 'M',
        color: 'Red',
        quantity: 0,
        lowStockAt: 5,
      },
    ]);
    expect(payload.lowStock).toEqual([
      {
        productTitle: 'Sofa',
        sku: 'SOFA-9',
        size: 'L',
        color: 'Blue',
        quantity: 3,
        lowStockAt: 5,
      },
    ]);
  });
});
