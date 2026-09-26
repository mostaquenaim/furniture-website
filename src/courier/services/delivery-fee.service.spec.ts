import {
  computeItemsWeightKg,
  DeliveryFeeService,
} from './delivery-fee.service';

describe('DeliveryFeeService', () => {
  let prisma: any;
  let service: DeliveryFeeService;
  let calculateRate: jest.Mock;

  const pathaoProvider = (config: Record<string, unknown> = {}) => ({
    isActive: true,
    config: { store_id: '338356', ...config },
  });

  beforeEach(() => {
    prisma = {
      city: { findUnique: jest.fn().mockResolvedValue({ deliveryFee: 120 }) },
      courierProvider: {
        findUnique: jest.fn().mockResolvedValue(pathaoProvider()),
      },
    };
    service = new DeliveryFeeService(
      prisma,
      {} as any,
      {
        get: jest.fn(),
      } as any,
    );
    calculateRate = jest.fn().mockResolvedValue({ totalCharge: 60 });
    (service as any).pathao = { calculateRate };
  });

  it('charges the Pathao Normal (48) price with no markup by default', async () => {
    const quote = await service.quote({
      districtId: 1,
      zoneId: 5,
      weightKg: 0.5,
    });

    expect(quote).toEqual({ fee: 60, source: 'pathao' });
    expect(calculateRate).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_type: 48,
        item_weight: 0.5,
        recipient_city: 1,
        recipient_zone: 5,
      }),
    );
  });

  it('adds a configured extra_charge and honours an explicit 0', async () => {
    prisma.courierProvider.findUnique.mockResolvedValueOnce(
      pathaoProvider({ extra_charge: 20 }),
    );
    expect(
      (await service.quote({ districtId: 1, zoneId: 5, weightKg: 0.5 })).fee,
    ).toBe(80);

    prisma.courierProvider.findUnique.mockResolvedValueOnce(
      pathaoProvider({ extra_charge: 0 }),
    );
    expect(
      (await service.quote({ districtId: 1, zoneId: 6, weightKg: 0.5 })).fee,
    ).toBe(60);
  });

  it('falls back to the district fee when Pathao fails, without caching it', async () => {
    calculateRate.mockRejectedValueOnce(new Error('Too Many Requests'));
    expect(
      await service.quote({ districtId: 1, zoneId: 5, weightKg: 0.5 }),
    ).toEqual({
      fee: 120,
      source: 'district',
    });

    expect(
      (await service.quote({ districtId: 1, zoneId: 5, weightKg: 0.5 })).fee,
    ).toBe(60);
  });

  it('falls back to the district fee when no zone is given', async () => {
    expect(await service.quote({ districtId: 1, weightKg: 0.5 })).toEqual({
      fee: 120,
      source: 'district',
    });
    expect(calculateRate).not.toHaveBeenCalled();
  });

  it('caches quotes so preview and order use the same Pathao price', async () => {
    await service.quote({ districtId: 1, zoneId: 5, weightKg: 0.3 });
    await service.quote({ districtId: 1, zoneId: 5, weightKg: 0.5 });

    // 0.3 kg is billed as 0.5 kg, so both hit the same cache entry.
    expect(calculateRate).toHaveBeenCalledTimes(1);
  });

  it('sums Decimal-like product weights by quantity', () => {
    expect(
      computeItemsWeightKg([
        { quantity: 2, weight: '0.5' },
        { quantity: 1, weight: null },
      ]),
    ).toBe(1);
  });
});
