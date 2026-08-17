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

interface CartFilter {
  productSlug?: string;
  colorId?: number;
  sizeId?: number;
  isSummary?: boolean;
}

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  // Live discount preview for a cart that has a coupon attached. Always
  // recomputed from current item prices/categories + the coupon's current
  // state — nothing about the discount is cached on the cart, so this
  // self-corrects if items change or the coupon is edited/expires, instead
  // of silently going stale (see coupon-pricing.util.ts).
  private async computeCartDiscount(
    cartId: number,
    coupon: CouponWithCategories | null,
  ): Promise<{ discountAmount: number; freeDelivery: boolean }> {
    if (!coupon) return { discountAmount: 0, freeDelivery: false };

    const window = isCouponWithinWindow(coupon);
    if (!window.ok) return { discountAmount: 0, freeDelivery: false };

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
    if (!cartCheck.ok) return { discountAmount: 0, freeDelivery: false };

    return {
      discountAmount: discount.discountAmount,
      freeDelivery: discount.freeDelivery,
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
      };
    }

    if (filter.isSummary) {
      const { discountAmount, freeDelivery } = await this.computeCartDiscount(
        cart.id,
        cart.coupon,
      );
      return {
        ...cart,
        items: [],
        discountAmount,
        freeDelivery,
      };
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

    for (const item of items) {
      const availableStock = item.productSize.quantity;

      if (availableStock <= 0) {
        await this.prisma.cartItem.delete({
          where: { id: item.id },
        });
        continue;
      }

      if (item.quantity > availableStock) {
        await this.prisma.cartItem.update({
          where: { id: item.id },
          data: {
            quantity: availableStock,
            subtotalAtAdd: availableStock * item.priceAtAdd,
            baseSubtotalAtAdd: availableStock * item.basePriceAtAdd,
          },
        });
      }
    }

    const { discountAmount, freeDelivery } = await this.computeCartDiscount(
      cart.id,
      cart.coupon,
    );

    return {
      ...cart,
      items,
      codAvailable,
      codMessage,
      discountAmount,
      freeDelivery,
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
      };
    }

    if (filter.isSummary) {
      const { discountAmount, freeDelivery } = await this.computeCartDiscount(
        cart.id,
        cart.coupon,
      );
      return {
        ...cart,
        items: [],
        discountAmount,
        freeDelivery,
      };
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

    for (const item of items) {
      const availableStock = item.productSize.quantity;

      if (availableStock <= 0) {
        await this.prisma.cartItem.delete({
          where: { id: item.id },
        });
        continue;
      }

      if (item.quantity > availableStock) {
        await this.prisma.cartItem.update({
          where: { id: item.id },
          data: {
            quantity: availableStock,
            subtotalAtAdd: availableStock * item.priceAtAdd,
            baseSubtotalAtAdd: availableStock * item.basePriceAtAdd,
          },
        });
      }
    }

    const { discountAmount, freeDelivery } = await this.computeCartDiscount(
      cart.id,
      cart.coupon,
    );

    return {
      ...cart,
      items,
      codAvailable,
      codMessage,
      discountAmount,
      freeDelivery,
    };
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

  // get or create cart
  async getOrCreateCart(userId: number) {
    // console.log(userId, 'userId');
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
    // console.log(productSize, 'productSize');

    const quantityToAdd = dto.quantity ?? 1;

    if (quantityToAdd <= 0) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    if (productSize.quantity < quantityToAdd) {
      throw new BadRequestException('Not enough stock');
    }

    if (productSize.price == null) {
      throw new BadRequestException('Variant price not set');
    }

    const basePrice =
      productSize.basePrice ?? productSize.color.product.basePrice;
    const finalPrice = productSize.price;

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
          subtotalAtAdd: finalPrice * newQty,
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

    const basePrice =
      productSize.basePrice ?? productSize.color.product.basePrice;
    const finalPrice = productSize.price ?? basePrice;

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
          subtotalAtAdd: finalPrice * newQty,
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

  // count cart items for a user
  async countCartItems(userId: number | null, visitorId: string | null) {
    // console.log(userId, visitorId, 'userid, visitoid');
    const cart = await this.prisma.cart.findFirst({
      // where: { userId, status: 'ACTIVE' },
      where: {
        status: 'ACTIVE',
        ...(userId ? { userId } : {}),
        ...(!userId && visitorId ? { visitorId } : {}),
      },
    });

    // console.log('cartfound', cart, 'cartfound');

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
        productSize: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (
      cartItem.productSize?.quantity &&
      quantity > cartItem.productSize.quantity
    ) {
      throw new BadRequestException('Insufficient stock');
    }

    const price = cartItem.priceAtAdd;
    const basePrice = cartItem.basePriceAtAdd;

    const updatedItem = await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: {
        quantity,
        subtotalAtAdd: price * quantity,
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

    const eligibilityItems = cart.items.map((item) => ({
      subtotalAtAdd: item.subtotalAtAdd,
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
}
