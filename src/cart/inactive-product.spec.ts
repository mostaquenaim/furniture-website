/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { OrderService } from '../order/order.service';

// A deactivated product — or a deactivated size of an active product — must
// not be bought: it can't be added to a cart, it drops out of carts it's
// already in, and checkout refuses it. Same rule the storefront uses to list
// a size (IN_STOCK_SIZE_WHERE: in stock and Size.isActive).

const productSize = ({
  productActive = true,
  sizeActive = true,
  quantity = 5,
} = {}) => ({
  id: 7,
  quantity,
  basePrice: 1000,
  price: 1000,
  discount: 0,
  discountType: null,
  color: {
    color: { name: 'Oak' },
    product: {
      isActive: productActive,
      title: 'Chair',
      discountStart: null,
      discountEnd: null,
      subCategories: [],
    },
  },
  size: { name: 'L', isActive: sizeActive },
});

const cartItem = (id: number, ps: ReturnType<typeof productSize>) => ({
  id,
  quantity: 1,
  priceAtAdd: 1000,
  basePriceAtAdd: 1000,
  subtotalAtAdd: 1000,
  baseSubtotalAtAdd: 1000,
  productSize: ps,
});

describe('deactivated products / sizes — cart', () => {
  let prisma: any;
  let cart: CartService;

  beforeEach(() => {
    prisma = {
      cart: {
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
        create: jest.fn(),
        update: jest.fn(),
      },
      productSize: { findUnique: jest.fn() },
      visitor: {
        findUnique: jest.fn().mockResolvedValue({ id: 'v1' }),
        upsert: jest.fn().mockResolvedValue({ id: 'v1' }),
        create: jest.fn().mockResolvedValue({ id: 'v1' }),
      },
      cartItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 99 }),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
      },
    };
    cart = new CartService(prisma);
  });

  const adders: [string, (s: CartService) => Promise<unknown>][] = [
    ['logged-in', (s) => s.addItemToCart(1, { productSizeId: 7 } as any)],
    ['guest', (s) => s.addItemToGuestCart('v1', { productSizeId: 7 } as any)],
  ];

  it.each(adders)(
    '%s add-to-cart refuses an inactive product',
    async (_who, add) => {
      prisma.productSize.findUnique.mockResolvedValue(
        productSize({ productActive: false }),
      );

      await expect(add(cart)).rejects.toThrow(
        'This product is no longer available',
      );
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    },
  );

  it.each(adders)(
    '%s add-to-cart refuses a deactivated size',
    async (_who, add) => {
      prisma.productSize.findUnique.mockResolvedValue(
        productSize({ sizeActive: false }),
      );

      await expect(add(cart)).rejects.toThrow(
        'This size is no longer available',
      );
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    },
  );

  it.each(adders)(
    '%s add-to-cart still works for an active product and size',
    async (_who, add) => {
      prisma.productSize.findUnique.mockResolvedValue(productSize());
      await expect(add(cart)).resolves.toEqual({ id: 99 });
    },
  );

  it.each([
    [
      'product',
      { productActive: false },
      'This product is no longer available',
    ],
    ['size', { sizeActive: false }, 'This size is no longer available'],
  ])(
    'changing the quantity of a deactivated %s is refused',
    async (_what, flags, message) => {
      prisma.cartItem.findFirst.mockResolvedValue({
        id: 3,
        cartId: 1,
        productSize: productSize(flags),
      });

      await expect(cart.updateItemQuantity(1, null, 3, 2)).rejects.toThrow(
        message,
      );
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    },
  );

  it('changing the quantity of an active item still works', async () => {
    prisma.cartItem.findFirst.mockResolvedValue({
      id: 3,
      cartId: 1,
      productSize: productSize(),
    });
    prisma.cartItem.update.mockResolvedValue({ id: 3, quantity: 2 });

    await expect(cart.updateItemQuantity(1, null, 3, 2)).resolves.toEqual({
      id: 3,
      quantity: 2,
    });
  });

  it('reading the cart drops deactivated products and sizes only', async () => {
    prisma.cartItem.findMany.mockResolvedValueOnce([
      cartItem(10, productSize({ productActive: false })),
      cartItem(11, productSize({ sizeActive: false })),
      cartItem(12, productSize()),
    ]);

    const result = await cart.getCartItems(1, null, {
      isSummary: true,
    } as any);

    expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 11 } });
    expect(prisma.cartItem.delete).toHaveBeenCalledTimes(2);
    expect(result.subtotalAtAdd).toBe(1000); // only the active item
  });

  it('the cart badge counts only what the cart page will show', async () => {
    await cart.countCartItems(1, null);

    expect(prisma.cartItem.count).toHaveBeenCalledWith({
      where: {
        cartId: 1,
        productSize: {
          quantity: { gt: 0 },
          size: { isActive: true },
          color: { product: { isActive: true } },
        },
      },
    });
  });
});

describe('deactivated products / sizes — checkout', () => {
  const makeOrders = (items: unknown[]) => {
    const prisma: any = {
      city: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 1, isCODAvailable: true }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 1, phone: '01712345678' }),
      },
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: 5,
          userId: 1,
          status: 'ACTIVE',
          couponId: null,
          items,
        }),
        update: jest.fn(),
      },
      cartItem: { update: jest.fn() },
      $transaction: jest.fn(),
    };
    // Only the cart checks are under test; the other deps are stubs
    const stub = {} as never;
    const orders = new OrderService(
      prisma,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
      stub,
    );
    return { prisma, orders };
  };

  const place = (orders: OrderService) =>
    orders.createOrder(1, {
      cartId: 5,
      paymentMethod: 'COD',
      address: { districtId: 1, phone: '01712345678' },
    } as any);

  it('refuses a cart holding a deactivated product', async () => {
    const { prisma, orders } = makeOrders([
      cartItem(1, productSize({ productActive: false })),
    ]);

    await expect(place(orders)).rejects.toThrow(
      '"Chair" is no longer available',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses a cart holding a deactivated size', async () => {
    const { prisma, orders } = makeOrders([
      cartItem(1, productSize()),
      cartItem(2, productSize({ sizeActive: false })),
    ]);

    await expect(place(orders)).rejects.toThrow(
      'Size "L" of "Chair" is no longer available',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not refuse a cart whose items are all active', async () => {
    const { orders } = makeOrders([cartItem(1, productSize())]);

    // It goes on to later steps (stubbed here, so it may fail there) — what
    // matters is that it isn't stopped by the availability checks.
    const outcome = await place(orders).then(
      () => 'resolved',
      (err: Error) => err.message,
    );
    expect(outcome).not.toMatch(/no longer available/);
  });

  it('a deactivated size is reported as a 400', async () => {
    const { orders } = makeOrders([
      cartItem(1, productSize({ sizeActive: false })),
    ]);
    await expect(place(orders)).rejects.toThrow(BadRequestException);
  });
});
