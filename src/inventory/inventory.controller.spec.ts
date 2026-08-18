import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { LowStockAlertService } from './low-stock-alert.service';

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            getInventory: jest.fn(),
            getLowStockSummary: jest.fn(),
            exportInventory: jest.fn(),
            getStockHistory: jest.fn(),
            adjustStock: jest.fn(),
            updateThreshold: jest.fn(),
          },
        },
        {
          provide: LowStockAlertService,
          useValue: { run: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
