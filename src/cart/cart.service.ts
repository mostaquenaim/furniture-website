/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from './dto/addCartItem.dto';
import { CouponDiscountType } from '@prisma/client';

interface CartFilter {
  productSlug?: string;
  colorId?: number;
  sizeId?: number;
  isSummary?: boolean;
}

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  // get all carts
  async getCartItems(userId: number, filter: CartFilter) {
    // console.log(filter, 'filterfilter');
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        subtotalAtAdd: true,
        baseSubtotalAtAdd: true,
        items: !filter.isSummary
          ? {
              where: {
                ...(filter.productSlug && {
                  productSize: {
                    color: {
                      product: {
                        slug: filter.productSlug,
                      },
                    },
                  },
                }),
                ...(filter.colorId && {
                  productSize: {
                    colorId: filter.colorId,
                  },
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
                    // colorId: true,
                    // sizeId: true,
                    price: true,
                    color: {
                      select: {
                        id: true,
                        product: {
                          select: {
                            id: true,
                            slug: true,
                            title: true,
                            basePrice: true,
                            // colors: {
                            //   select: {
                            //     images: {
                            //       select: {
                            //         id: true,
                            //         image: true,
                            //       },
                            //       take: 1,
                            //     },
                            //   },
                            // },
                          },
                        },
                        images: {
                          select: {
                            id: true,
                            image: true,
                          },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            }
          : false,
        couponId: true,
        coupon: {
          where: {
            isActive: true,
            startDate: { lte: new Date() },
            expiryDate: { gte: new Date() },
          },
          select: {
            code: true,
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // console.log('cartfound', cart, 'cartfound');
    // console.log(' itemzz', cart, 'itemzz');
    // console.log('dtoooo', JSON.stringify(cart, null, 2), 'dtoooo');

    // console.log(cart.items, 'cartitems');
    return cart;
  }

  // get cart by product size id
  async getCartItemByProductSizeId(
    userId: number,
    filter: { sizeId?: number },
  ) {}

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
    console.log(userId, 'userId');
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

    const basePrice = productSize.color.product.basePrice;

    const finalPrice = productSize.price ?? productSize.color.product.basePrice;

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
  async countCartItems(userId: number) {
    const cart = await this.prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (!cart) return 0;

    return this.prisma.cartItem.count({
      where: { cartId: cart.id },
    });
  }

  // update cart item quantity
  async updateItemQuantity(
    userId: number,
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
          userId,
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
  async applyCoupon(cartId: number, couponCode: string) {
    // Fetch cart with items
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId, status: 'ACTIVE' },
      include: { items: true, coupon: true },
    });

    if (!cart) throw new NotFoundException('Cart not found');

    // Calculate cart total
    const cartTotal = cart.items.reduce(
      (sum, item) => sum + item.subtotalAtAdd,
      0,
    );

    // Fetch coupon
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: couponCode,
        isActive: true,
        startDate: { lte: new Date() },
        expiryDate: { gte: new Date() },
      },
    });

    if (!coupon) throw new BadRequestException('Invalid or expired coupon');

    // Check min order value
    if (coupon.minOrderValue && cartTotal < coupon.minOrderValue) {
      throw new BadRequestException(
        `Minimum order value for this coupon is ${coupon.minOrderValue}`,
      );
    }

    // Calculate discount
    let discountAmount = 0;
    switch (coupon.discountType) {
      case CouponDiscountType.FIXED_AMOUNT:
        discountAmount = coupon.discountValue ?? 0;
        break;
      case CouponDiscountType.PERCENTAGE:
        discountAmount = Math.min(
          ((coupon.discountValue ?? 0) / 100) * cartTotal,
          coupon.maxDiscount ?? Infinity,
        );
        break;
      case CouponDiscountType.FREE_DELIVERY:
        discountAmount = 0; // handle free delivery separately in shipping
        break;
    }

    // Update cart with new coupon (replacing any previous)
    const updatedCart = await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotalAtAdd: cartTotal - discountAmount,
        couponId: coupon.id, // replaces previous coupon
      },
      include: { items: true, coupon: true },
    });

    return {
      cart: updatedCart,
      discountAmount,
      coupon,
    };
  }

  // delete item
  async removeItem(userId: number, cartItemId: number) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cart: {
          userId,
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
