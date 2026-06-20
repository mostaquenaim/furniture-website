import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { StockLedgerService } from './stock-ledger.service';
import { StockEventsGateway } from 'src/realtime/stock-events.gateway';

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: {} },
        { provide: ActivityLogService, useValue: { log: jest.fn() } },
        { provide: StockLedgerService, useValue: {} },
        {
          provide: StockEventsGateway,
          useValue: { emitStockUpdated: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
