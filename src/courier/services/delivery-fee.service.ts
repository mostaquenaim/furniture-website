/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { PathaoProvider } from '../providers/pathao.provider';

// Pathao bills anything under 0.5 kg as 0.5 kg, and its price plan only goes
// up to 10 kg (see PathaoProvider.calculateRate). Heavier parcels — common
// for furniture — are quoted at the 10 kg price plus `extra_per_kg` (from the
// Pathao provider config) for every started kg above 10.
const MIN_BILLABLE_KG = 0.5;
const PATHAO_MAX_KG = 10;

// Pathao's price plans change rarely; caching keeps the checkout preview and
// the order-time charge on the same number and keeps us under Pathao's
// account-wide rate limit.
const QUOTE_CACHE_TTL_MS = 30 * 60 * 1000;
const QUOTE_CACHE_MAX_ENTRIES = 5000;

export interface DeliveryFeeQuote {
  fee: number;
  /** 'pathao' = live price plan; 'district' = the district's flat fee, used
   * when Pathao is unavailable or no zone was given. */
  source: 'pathao' | 'district';
}

/** Shipping weight of one unit: the size's own weight if set, else the
 * product's. */
export function resolveUnitWeight(
  sizeWeight: unknown,
  productWeight: unknown,
): unknown {
  return sizeWeight ?? productWeight;
}

/** Total parcel weight in kg for a set of cart/order lines. Weights are
 * Prisma Decimals, so they're coerced with Number(). */
export function computeItemsWeightKg(
  items: { quantity: number; weight: unknown }[],
): number {
  return items.reduce((sum, item) => {
    const weight = Number(item.weight ?? 0);
    return sum + (Number.isFinite(weight) ? weight : 0) * item.quantity;
  }, 0);
}

/**
 * Single source of truth for the customer-facing delivery charge. Both the
 * checkout preview (POST /delivery/fee) and OrderService.createOrder call
 * quote(), so what the customer is shown is exactly what they're charged.
 */
@Injectable()
export class DeliveryFeeService {
  private readonly logger = new Logger(DeliveryFeeService.name);
  private readonly pathao: PathaoProvider;
  private readonly cache = new Map<
    string,
    { fee: number; expiresAt: number }
  >();

  constructor(
    private prisma: PrismaService,
    httpService: HttpService,
    configService: ConfigService,
  ) {
    this.pathao = new PathaoProvider(httpService, configService);
  }

  async getCartWeightKg(cartId: number, userId?: number | null, visitorId?: string): Promise<number> {
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, status: 'ACTIVE', ...(userId ? { userId } : { visitorId}) },
      select: {
        items: {
          select: {
            quantity: true,
            productSize: {
              select: {
                weight: true,
                color: { select: { product: { select: { weight: true } } } },
              },
            },
          },
        },
      },
    });

    if (!cart) throw new BadRequestException('Cart not found');

    return computeItemsWeightKg(
      cart.items.map((item) => ({
        quantity: item.quantity,
        weight: resolveUnitWeight(
          item.productSize?.weight,
          item.productSize?.color?.product?.weight,
        ),
      })),
    );
  }

  async quote(params: {
    districtId: number;
    zoneId?: number | null;
    weightKg: number;
  }): Promise<DeliveryFeeQuote> {
    const district = await this.prisma.city.findUnique({
      where: { id: params.districtId },
      select: { deliveryFee: true },
    });
    if (!district) throw new BadRequestException('Invalid district selected');

    const fallback: DeliveryFeeQuote = {
      fee: Math.round(district.deliveryFee),
      source: 'district',
    };

    if (!params.zoneId) return fallback;

    const billableKg =
      Math.round(Math.max(params.weightKg || 0, MIN_BILLABLE_KG) * 100) / 100;
    const pricedKg = Math.min(billableKg, PATHAO_MAX_KG);
    const overweightKg = Math.max(0, Math.ceil(billableKg - PATHAO_MAX_KG));

    const cacheKey = `${params.districtId}:${params.zoneId}:${billableKg}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { fee: cached.fee, source: 'pathao' };
    }

    const provider: any = await this.prisma.courierProvider.findUnique({
      where: { name: 'pathao' },
    });
    const storeId =
      provider?.config?.store_id || provider?.config?.merchant_store_id;

    if (!provider?.isActive || !storeId) {
      this.logger.warn(
        'Pathao provider inactive or store_id missing — using district delivery fee',
      );
      return fallback;
    }

    try {
      const rate = await this.pathao.calculateRate({
        store_id: storeId,
        item_type: 2, // Parcel (1 = Document)
        delivery_type: 48, // Normal delivery — never On Demand for customer quotes
        item_weight: pricedKg,
        recipient_city: params.districtId,
        recipient_zone: params.zoneId,
      });

      const pathaoFee = Number(rate?.totalCharge);
      if (!Number.isFinite(pathaoFee) || pathaoFee <= 0) {
        this.logger.warn(
          `Pathao returned no usable price for ${cacheKey} — using district delivery fee`,
        );
        return fallback;
      }

      // Optional merchant markup on top of Pathao's price, set via the
      // provider's config JSON. Absent means none — an explicit 0 is honoured.
      const extra = Number(provider.config?.extra_charge ?? 0);

      let overweightCharge = 0;
      if (overweightKg > 0) {
        const perKg = Number(provider.config?.extra_per_kg);
        if (Number.isFinite(perKg) && perKg > 0) {
          overweightCharge = overweightKg * perKg;
        } else {
          this.logger.warn(
            `Parcel is ${billableKg} kg (over Pathao's ${PATHAO_MAX_KG} kg plan) but extra_per_kg is not set in the Pathao provider config — quoting the ${PATHAO_MAX_KG} kg price only`,
          );
        }
      }

      const fee = Math.round(
        pathaoFee +
          (Number.isFinite(extra) && extra > 0 ? extra : 0) +
          overweightCharge,
      );

      if (this.cache.size >= QUOTE_CACHE_MAX_ENTRIES) this.cache.clear();
      this.cache.set(cacheKey, {
        fee,
        expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
      });

      return { fee, source: 'pathao' };
    } catch (error) {
      this.logger.error(
        `Pathao price-plan failed for ${cacheKey} — using district delivery fee`,
        error?.message ?? error,
      );
      return fallback;
    }
  }
}
