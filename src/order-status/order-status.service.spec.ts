import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, ProductTrackingMode, StockAdjustReason } from '@prisma/client';
import { OrderStatusService } from './order-status.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { ReservationService } from '../reservation/reservation.service';

describe('OrderStatusService', () => {
  let service: OrderStatusService;
  let stockLedgerService: { recordAdjustment: jest.Mock };
  let reservationService: { releaseReservationsForOrder: jest.Mock };

  const baseOrder = {
    id: 1,
    orderId: 'ORD-1',
    status: OrderStatus.SHIPPED,
    stockRestored: false,
  };

  function makeItem(overrides: Partial<any> = {}) {
    return {
      id: 10,
      productId: 100,
      productSizeId: 1000,
      quantity: 2,
      productSize: { trackingMode: ProductTrackingMode.LEGACY_QUANTITY },
      ...overrides,
    };
  }

  function makeTx(items: any[]) {
    return {
      order: {
        findUnique: jest.fn().mockResolvedValue({ ...baseOrder, items }),
        update: jest.fn().mockResolvedValue({ ...baseOrder, status: OrderStatus.RETURNED }),
      },
      productSize: { update: jest.fn().mockResolvedValue({}) },
      product: { update: jest.fn().mockResolvedValue({}) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    } as any;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderStatusService,
        {
          provide: StockLedgerService,
          useValue: {
            recordAdjustment: jest.fn().mockResolvedValue({ quantityAfter: 5, lowStockAt: 2 }),
          },
        },
        {
          provide: ReservationService,
          useValue: { releaseReservationsForOrder: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(OrderStatusService);
    stockLedgerService = module.get(StockLedgerService) as any;
    reservationService = module.get(ReservationService) as any;
  });

  it('restores stock for a PIECE_BARCODE item on CANCELLED (piece never left the warehouse)', async () => {
    const items = [
      makeItem({ productSize: { trackingMode: ProductTrackingMode.PIECE_BARCODE } }),
    ];
    const tx = makeTx(items);

    const result = await service.applyStatusChange(tx, {
      orderPk: 1,
      newStatus: OrderStatus.CANCELLED,
    });

    expect(stockLedgerService.recordAdjustment).toHaveBeenCalledTimes(1);
    expect(stockLedgerService.recordAdjustment).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        productSizeId: 1000,
        delta: 2,
        reason: StockAdjustReason.ORDER_CANCELLED,
      }),
    );
    expect(result.stockRestored).toBe(true);
    expect(result.stockEvents).toHaveLength(1);
  });

  it('does NOT restore stock for a PIECE_BARCODE item on RETURNED (must wait for a physical scan)', async () => {
    const items = [
      makeItem({ productSize: { trackingMode: ProductTrackingMode.PIECE_BARCODE } }),
    ];
    const tx = makeTx(items);

    const result = await service.applyStatusChange(tx, {
      orderPk: 1,
      newStatus: OrderStatus.RETURNED,
    });

    expect(reservationService.releaseReservationsForOrder).toHaveBeenCalledWith(tx, 1);
    expect(stockLedgerService.recordAdjustment).not.toHaveBeenCalled();
    expect(tx.productSize.update).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
    // Order status itself still moves forward and stockRestored is still
    // flagged true so this codepath isn't retried — actual restocking
    // happens later via PieceService.returnReceive on barcode scan.
    expect(result.stockEvents).toHaveLength(0);
  });

  it('still restores stock for a non-piece-tracked (LEGACY_QUANTITY) item on RETURNED', async () => {
    const items = [makeItem({ productSize: { trackingMode: ProductTrackingMode.LEGACY_QUANTITY } })];
    const tx = makeTx(items);

    await service.applyStatusChange(tx, {
      orderPk: 1,
      newStatus: OrderStatus.RETURNED,
    });

    expect(stockLedgerService.recordAdjustment).toHaveBeenCalledTimes(1);
    expect(stockLedgerService.recordAdjustment).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        productSizeId: 1000,
        delta: 2,
        reason: StockAdjustReason.ORDER_RETURNED,
      }),
    );
  });

  it('handles a mixed cart: skips the PIECE_BARCODE item but restores the LEGACY_QUANTITY item on RETURNED', async () => {
    const items = [
      makeItem({
        id: 10,
        productSizeId: 1000,
        productSize: { trackingMode: ProductTrackingMode.PIECE_BARCODE },
      }),
      makeItem({
        id: 11,
        productSizeId: 2000,
        productSize: { trackingMode: ProductTrackingMode.LEGACY_QUANTITY },
      }),
    ];
    const tx = makeTx(items);

    const result = await service.applyStatusChange(tx, {
      orderPk: 1,
      newStatus: OrderStatus.RETURNED,
    });

    expect(stockLedgerService.recordAdjustment).toHaveBeenCalledTimes(1);
    expect(stockLedgerService.recordAdjustment).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ productSizeId: 2000 }),
    );
    expect(result.stockEvents).toHaveLength(1);
    expect(result.stockEvents[0].productSizeId).toBe(2000);
  });
});
