/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from './dto/addCartItem.dto';
import {
  computeCouponDiscount,
  CouponWithCategories,
  isCouponWithinWindow,
  validateCouponAgainstCart,
} from 'src/cms/coupon-pricing.util';
import { effectiveSizePrice } from 'src/common/utils/discount.utils';

interface CartFilter {
  productSlug?: string;
  colorId?: number;
  sizeId?: number;
  isSummary?: boolean;
}

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Brings a cart in line with live data before it's read: drops items whose
   * size is out of stock, clamps quantities to stock, re-prices every item to
   * its size's current effective price (honouring the product's discount
   * window, either direction), and recomputes the cart totals. Writes only
   * what changed. Returns the fresh totals.
   */
  private async refreshCart(
    cartId: number,
  ): Promise<{ subtotalAtAdd: number; baseSubtotalAtAdd: number }> {
    const now = new Date();
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      select: {
        id: true,
        quantity: true,
        priceAtAdd: true,
        basePriceAtAdd: true,
        subtotalAtAdd: true,
        baseSubtotalAtAdd: true,
        productSize: {
          select: {
            quantity: true,
            price: true,
            basePrice: true,
            color: {
              select: {
                product: {
                  select: { discountStart: true, discountEnd: true },
                },
              },
            },
          },
        },
      },
    });

    let subtotalAtAdd = 0;
    let baseSubtotalAtAdd = 0;

    for (const item of items) {
      const stock = item.productSize.quantity;
      if (stock <= 0) {
        await this.prisma.cartItem.delete({ where: { id: item.id } });
        continue;
      }

      const quantity = Math.min(item.quantity, stock);
      const price = effectiveSizePrice(
        item.productSize,
        item.productSize.color.product,
        now,
      );
      const basePrice = item.productSize.basePrice;
      const subtotal = price * quantity;
      const baseSubtotal = basePrice * quantity;

      if (
        quantity !== item.quantity ||
        price !== item.priceAtAdd ||
        basePrice !== item.basePriceAtAdd ||
        subtotal !== item.subtotalAtAdd ||
        baseSubtotal !== item.baseSubtotalAtAdd
      ) {
        await this.prisma.cartItem.update({
          where: { id: item.id },
          data: {
            quantity,
            priceAtAdd: price,
            subtotalAtAdd: subtotal,
            basePriceAtAdd: basePrice,
            baseSubtotalAtAdd: baseSubtotal,
          },
        });
      }

      subtotalAtAdd += subtotal;
      baseSubtotalAtAdd += baseSubtotal;
    }

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { subtotalAtAdd, baseSubtotalAtAdd },
    });

    return { subtotalAtAdd, baseSubtotalAtAdd };
  }

  // Live discount preview for a cart that has a coupon attached. Always
  // recomputed from current item prices/categories + the coupon's current
  // state — nothing about the discount is cached on the cart, so this
  // self-corrects if items change or the coupon is edited/expires, instead
  // of silently going stale (see coupon-pricing.util.ts).
  //
  // A coupon that's inactive/expired/not-yet-started (e.g. an admin switched
  // it back to draft) is unlinked from the cart here, so the customer never
  // sees a dead code "applied" and order creation can't be blocked by it.
  // A live coupon the cart just doesn't qualify for (min spend, categories)
  // stays linked — adding items can make it apply — and couponError says why.
  private async resolveCartCoupon<
    T extends { id: number; couponId: number | null },
  >(
    cart: T & { coupon: CouponWithCategories | null },
  ): Promise<
    T & {
      coupon: CouponWithCategories | null;
      discountAmount: number;
      freeDelivery: boolean;
      couponError: string | null;
    }
  > {
    if (cart.coupon && !isCouponWithinWindow(cart.coupon).ok) {
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { couponId: null },
      });
      return {
        ...cart,
        couponId: null,
        coupon: null,
        discountAmount: 0,
        freeDelivery: false,
        couponError: null,
      };
    }

    const { discountAmount, freeDelivery, couponError } =
      await this.computeCartDiscount(cart.id, cart.coupon);
    return { ...cart, discountAmount, freeDelivery, couponError };
  }

  private async computeCartDiscount(
    cartId: number,
    coupon: CouponWithCategories | null,
  ): Promise<{
    discountAmount: number;
    freeDelivery: boolean;
    couponError: string | null;
  }> {
    if (!coupon) {
      return { discountAmount: 0, freeDelivery: false, couponError: null };
    }

    const window = isCouponWithinWindow(coupon);
    if (!window.ok) {
      return {
        discountAmount: 0,
        freeDelivery: false,
        couponError: window.reason,
      };
    }

    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      select: {
        subtotalAtAdd: true,
        productSize: {
          select: {
            color: {
              select: {
                product: {
                  select: {
                    subCategories: {
                      select: { subCategory: { select: { categoryId: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const eligibilityItems = items.map((item) => ({
      subtotalAtAdd: item.subtotalAtAdd,
      categoryIds: item.productSize.color.product.subCategories.map(
        (psc) => psc.subCategory.categoryId,
      ),
    }));

    const discount = computeCouponDiscount(eligibilityItems, coupon);
    const cartCheck = validateCouponAgainstCart(coupon, discount);
    if (!cartCheck.ok) {
      return {
        discountAmount: 0,
        freeDelivery: false,
        couponError: cartCheck.reason,
      };
    }

    return {
      discountAmount: discount.discountAmount,
      freeDelivery: discount.freeDelivery,
      couponError: null,
    };
  }

  // get all carts
  async getCartItems(
    userId: number | null,
    visitorId: string | null,
    filter: CartFilter,
  ) {
    if (!visitorId && !userId) {
      throw new BadRequestException('visitorId required');
    }

    const cart = await this.prisma.cart.findFirst({
      where: {
        status: 'ACTIVE',
        ...(userId ? { userId } : {}),
        ...(!userId && visitorId ? { visitorId } : {}),
      },
      select: {
        id: true,
        subtotalAtAdd: true,
        baseSubtotalAtAdd: true,
        coupon: { include: { categories: true } },
        couponId: true,
      },
    });

    if (!cart) {
      return {
        id: null,
        subtotalAtAdd: 0,
        baseSubtotalAtAdd: 0,
        items: [],
        couponId: null,
        coupon: null,
        discountAmount: 0,
        freeDelivery: false,
        couponError: null,
      };
    }

    return this.buildCartResponse(cart, filter);
  }

  // Shared tail of getCartItems/getGuestCartItems: refresh the cart against
  // live stock/prices first, so everything returned (items, totals, coupon
  // discount) reflects what the order would actually charge right now.
  private async buildCartResponse<
    T extends {
      id: number;
      couponId: number | null;
      subtotalAtAdd: number;
      baseSubtotalAtAdd: number;
      coupon: CouponWithCategories | null;
    },
  >(cart: T, filter: CartFilter) {
    Object.assign(cart, await this.refreshCart(cart.id));

    if (filter.isSummary) {
      return { ...(await this.resolveCartCoupon(cart)), items: [] };
    }

    const items = await this.prisma.cartItem.findMany({
      where: {
        cartId: cart.id,
        ...(filter.productSlug && {
          productSize: {
            color: {
              product: { slug: filter.productSlug },
            },
          },
        }),
        ...(filter.colorId && {
          productSize: { colorId: filter.colorId },
        }),
        ...(filter.sizeId && {
          productSizeId: filter.sizeId,
        }),
      },
      select: {
        id: true,
        quantity: true,
        priceAtAdd: true,
        subtotalAtAdd: true,
        basePriceAtAdd: true,
        baseSubtotalAtAdd: true,
        color: true,
        size: true,
        productSizeId: true,
        productSize: {
          select: {
            id: true,
            quantity: true,
            price: true,
            basePrice: true,
            size: {
              select: {
                id: true,
                name: true,
              },
            },
            color: {
              select: {
                id: true,
                color: {
                  select: {
                    id: true,
                    name: true,
                    hexCode: true,
                  },
                },
                product: {
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    basePrice: true,
                    material: true,
                    createdAt: true,
                    images: {
                      select: { image: true },
                    },
                    subCategories: {
                      select: {
                        subCategory: {
                          select: {
                            id: true,
                            name: true,
                            isCODAvailable: true,
                            category: {
                              select: {
                                id: true,
                                name: true,
                                series: {
                                  select: {
                                    id: true,
                                    name: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                    weight: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // cod check
    let codAvailable: boolean = true;
    let codMessage: string | null = null;

    for (const item of items) {
      const product = item.productSize.color.product;

      const hasNonCodSubcategory = product.subCategories.some(
        (psc) => !psc.subCategory.isCODAvailable,
      );

      if (hasNonCodSubcategory) {
        codAvailable = false;
        codMessage = `Cash on Delivery is not available for ${product.title}`;
        break;
      }
    }

    return {
      ...(await this.resolveCartCoupon(cart)),
      items,
      codAvailable,
      codMessage,
    };
  }

  // guest cart get
  async getGuestCartItems(visitorId: string, filter: CartFilter) {
    if (!visitorId) {
      throw new BadRequestException('visitorId required');
    }

    const cart = await this.prisma.cart.findFirst({
      where: {
        visitorId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        subtotalAtAdd: true,
        baseSubtotalAtAdd: true,
        coupon: { include: { categories: true } },
        couponId: true,
      },
    });

    if (!cart) {
      return {
        id: null,
        items: [],
        subtotalAtAdd: 0,
        baseSubtotalAtAdd: 0,
        discountAmount: 0,
        freeDelivery: false,
        couponError: null,
      };
    }

    return this.buildCartResponse(cart, filter);
  }

  // create cart
  async createCart(userId: number) {
    // ensure user has only one active cart
    const existingCart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (existingCart) {
      return existingCart;
    }

    return this.prisma.cart.create({
      data: {
        userId,
      },
    });
  }

  async getOrCreateCart(userId: number) {
    let cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { userId } });
    }
    return cart;
  }

  // guest cart
  async getOrCreateGuestCart(visitorId: string) {
    let visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
    });

    if (!visitor) {
      visitor = await this.prisma.visitor.create({
        data: {
          id: visitorId,
        },
      });
    }

    let cart = await this.prisma.cart.findFirst({
      where: {
        visitorId,
        status: 'ACTIVE',
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          visitorId,
        },
      });
    }

    return cart;
  }

  // add item to cart
  async addItemToCart(userId: number, dto: AddCartItemDto) {
    const cart = await this.getOrCreateCart(userId);

    const productSize = await this.prisma.productSize.findUnique({
      where: { id: dto.productSizeId },
      include: {
        color: { include: { product: true, color: true } },
        size: true,
      },
    });

    if (!productSize) {
      throw new NotFoundException('Product variant not found');
    }

    const quantityToAdd = dto.quantity ?? 1;

    if (quantityToAdd <= 0) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    if (productSize.quantity < quantityToAdd) {
      throw new BadRequestException('Not enough stock');
    }

    const basePrice = productSize.basePrice;
    const finalPrice = effectiveSizePrice(
      productSize,
      productSize.color.product,
    );

    const colorName = productSize.color.color.name;
    const sizeName = productSize.size.name;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productSizeId: productSize.id,
      },
    });

    let cartItem;

    if (existingItem) {
      // update existing item
      const newQty = existingItem.quantity + quantityToAdd;

      if (newQty > productSize.quantity) {
        throw new BadRequestException('Stock limit exceeded');
      }

      cartItem = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQty,
          priceAtAdd: finalPrice,
          subtotalAtAdd: finalPrice * newQty,
          basePriceAtAdd: basePrice,
          baseSubtotalAtAdd: basePrice * newQty,
        },
      });
    } else {
      // create new item
      cartItem = await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productSizeId: productSize.id,
          quantity: quantityToAdd,

          priceAtAdd: finalPrice,
          subtotalAtAdd: finalPrice * quantityToAdd,

          basePriceAtAdd: basePrice,
          baseSubtotalAtAdd: basePrice * quantityToAdd,

          color: colorName,
          size: sizeName,
        },
      });
    }

    // Update cart totals
    const totals = await this.prisma.cartItem.aggregate({
      where: { cartId: cart.id },
      _sum: {
        subtotalAtAdd: true,
        baseSubtotalAtAdd: true,
      },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotalAtAdd: totals._sum.subtotalAtAdd ?? 0,
        baseSubtotalAtAdd: totals._sum.baseSubtotalAtAdd ?? 0,
      },
    });

    return cartItem;
  }

  // add items to guest cart
  async addItemToGuestCart(visitorId: string, dto: AddCartItemDto) {
    if (!visitorId) {
      throw new BadRequestException('visitorId required');
    }

    const cart = await this.getOrCreateGuestCart(visitorId);

    const productSize = await this.prisma.productSize.findUnique({
      where: { id: dto.productSizeId },
      include: {
        color: { include: { product: true, color: true } },
        size: true,
      },
    });

    if (!productSize) {
      throw new NotFoundException('Product variant not found');
    }

    const quantityToAdd = dto.quantity ?? 1;

    if (quantityToAdd <= 0) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    if (productSize.quantity < quantityToAdd) {
      throw new BadRequestException('Not enough stock');
    }

    const basePrice = productSize.basePrice;
    const finalPrice = effectiveSizePrice(
      productSize,
      productSize.color.product,
    );

    const colorName = productSize.color.color.name;
    const sizeName = productSize.size.name;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productSizeId: productSize.id,
      },
    });

    let cartItem;

    if (existingItem) {
      const newQty = existingItem.quantity + quantityToAdd;

      if (newQty > productSize.quantity) {
        throw new BadRequestException('Stock limit exceeded');
      }

      cartItem = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQty,
          priceAtAdd: finalPrice,
          subtotalAtAdd: finalPrice * newQty,
          basePriceAtAdd: basePrice,
          baseSubtotalAtAdd: basePrice * newQty,
        },
      });
    } else {
      cartItem = await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productSizeId: productSize.id,
          quantity: quantityToAdd,

          priceAtAdd: finalPrice,
          subtotalAtAdd: finalPrice * quantityToAdd,

          basePriceAtAdd: basePrice,
          baseSubtotalAtAdd: basePrice * quantityToAdd,

          color: colorName,
          size: sizeName,
        },
      });
    }

    const totals = await this.prisma.cartItem.aggregate({
      where: { cartId: cart.id },
      _sum: {
        subtotalAtAdd: true,
        baseSubtotalAtAdd: true,
      },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotalAtAdd: totals._sum.subtotalAtAdd ?? 0,
        baseSubtotalAtAdd: totals._sum.baseSubtotalAtAdd ?? 0,
      },
    });

    return cartItem;
  }

  // checkout cart
  async checkoutCart(userId: number) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0)
      throw new BadRequestException('Cart is empty');

    // mark cart as checked out
    return this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        status: 'CHECKED_OUT',
      },
    });
  }

  async countCartItems(userId: number | null, visitorId: string | null) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        status: 'ACTIVE',
        ...(userId ? { userId } : {}),
        ...(!userId && visitorId ? { visitorId } : {}),
      },
    });

    if (!cart) return 0;

    return this.prisma.cartItem.count({
      where: { cartId: cart.id },
    });
  }

  // update cart item quantity
  async updateItemQuantity(
    userId: number | null,
    visitorId: string | null,
    cartItemId: number,
    quantity: number,
  ) {
    if (quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          ...(userId ? { userId } : {}),
          ...(!userId && visitorId ? { visitorId } : {}),
          status: 'ACTIVE',
        },
      },
      include: {
        productSize: {
          include: {
            color: {
              select: {
                product: {
                  select: { discountStart: true, discountEnd: true },
                },
              },
            },
          },
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (quantity > cartItem.productSize.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const price = effectiveSizePrice(
      cartItem.productSize,
      cartItem.productSize.color.product,
    );
    const basePrice = cartItem.productSize.basePrice;

    const updatedItem = await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity,
        priceAtAdd: price,
        subtotalAtAdd: price * quantity,
        basePriceAtAdd: basePrice,
        baseSubtotalAtAdd: basePrice * quantity,
      },
    });

    // Recalculate cart totals
    const cartItems = await this.prisma.cartItem.findMany({
      where: {
        cartId: cartItem.cartId,
      },
    });

    const subtotalAtAdd = cartItems.reduce(
      (sum, i) => sum + Number(i.subtotalAtAdd),
      0,
    );

    const baseSubtotalAtAdd = cartItems.reduce(
      (sum, i) => sum + Number(i.baseSubtotalAtAdd),
      0,
    );

    await this.prisma.cart.update({
      where: { id: cartItem.cartId },
      data: {
        subtotalAtAdd,
        baseSubtotalAtAdd,
      },
    });

    return updatedItem;
  }

  // apply coupon
  async applyCoupon(
    userId: number | null,
    visitorId: string | null,
    cartId: number,
    couponCode: string,
  ) {
    // Fetch cart with items and each item's categories, so eligibility can
    // be checked without a second round trip.
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        status: 'ACTIVE',
        ...(userId ? { userId } : {}),
        ...(!userId && visitorId ? { visitorId } : {}),
      },
      include: {
        items: {
          include: {
            productSize: {
              include: {
                color: {
                  include: {
                    product: {
                      include: {
                        subCategories: { include: { subCategory: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { code: couponCode.toUpperCase().trim() },
      include: { categories: true },
    });

    if (!coupon) throw new BadRequestException('Invalid coupon code');

    const window = isCouponWithinWindow(coupon);
    if (!window.ok) throw new BadRequestException(window.reason);

    // Same limits createOrder enforces — checked here too so a spent coupon
    // is rejected when it's applied, not only at "Place Order".
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (userId && coupon.perUserLimit != null) {
      const usedByUser = await this.prisma.order.count({
        where: { userId, couponId: coupon.id },
      });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException(
          'You have already used this coupon the maximum number of times',
        );
      }
    }

    // Live prices, not the stored subtotals — the cart may not have been
    // refreshed since a discount window opened/closed.
    const eligibilityItems = cart.items.map((item) => ({
      subtotalAtAdd:
        effectiveSizePrice(item.productSize, item.productSize.color.product) *
        item.quantity,
      categoryIds: item.productSize.color.product.subCategories.map(
        (psc) => psc.subCategory.categoryId,
      ),
    }));

    const discount = computeCouponDiscount(eligibilityItems, coupon);
    const cartCheck = validateCouponAgainstCart(coupon, discount);
    if (!cartCheck.ok) throw new BadRequestException(cartCheck.reason);

    // Only the coupon link is persisted — never the discount itself, so it
    // can't go stale if items are added/removed afterwards. Every read
    // (getCartItems) and order creation recompute it fresh from this link.
    const updatedCart = await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponId: coupon.id },
      include: { items: true, coupon: true },
    });

    return {
      cart: updatedCart,
      discountAmount: discount.discountAmount,
      freeDelivery: discount.freeDelivery,
      coupon,
    };
  }

  // remove coupon
  async removeCoupon(
    userId: number | null,
    visitorId: string | null,
    cartId: number,
  ) {
    if (!userId && !visitorId) {
      throw new BadRequestException('visitorId required');
    }

    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        status: 'ACTIVE',
        ...(userId ? { userId } : {}),
        ...(!userId && visitorId ? { visitorId } : {}),
      },
    });

    if (!cart) throw new NotFoundException('Cart not found');

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponId: null },
    });

    return { success: true };
  }

  // delete item
  async removeItem(
    userId: number | null,
    visitorId: string | null,
    cartItemId: number,
  ) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          ...(userId ? { userId } : {}),
          ...(!userId && visitorId ? { visitorId } : {}),
          status: 'ACTIVE',
        },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    // Recalculate cart totals
    const remainingItems = await this.prisma.cartItem.findMany({
      where: { cartId: cartItem.cartId },
    });

    const subtotalAtAdd = remainingItems.reduce(
      (sum, i) => sum + Number(i.subtotalAtAdd),
      0,
    );

    const baseSubtotalAtAdd = remainingItems.reduce(
      (sum, i) => sum + Number(i.baseSubtotalAtAdd),
      0,
    );

    await this.prisma.cart.update({
      where: { id: cartItem.cartId },
      data: {
        subtotalAtAdd,
        baseSubtotalAtAdd,
      },
    });

    return { success: true };
  }

  // Empties the user's active cart in one shot — used by "Buy Now" to
  // discard whatever's already in the cart before adding just the one
  // product being purchased directly, so checkout can't accidentally
  // bundle in unrelated items.
  async clearCart(userId: number | null, visitorId: string | null) {
    // Without an owner the filter below would be just { status: 'ACTIVE' }
    // and match (and wipe) some other customer's cart.
    if (!userId && !visitorId) return { success: true };

    const cart = await this.prisma.cart.findFirst({
      where: {
        status: 'ACTIVE',
        ...(userId ? { userId } : {}),
        ...(!userId && visitorId ? { visitorId } : {}),
      },
    });

    if (!cart) return { success: true };

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotalAtAdd: 0,
        baseSubtotalAtAdd: 0,
        couponId: null,
      },
    });

    return { success: true };
  }
}
