/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from './dto/addCartItem.dto';

interface CartFilter {
  productId?: number;
  colorId?: number;
  sizeId?: number;
}

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  // get all carts
  async getCartItems(userId: number, filter: CartFilter) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        items: {
          where: {
            // apply optional filters
            ...(filter.productId && {
              productSize: {
                color: {
                  productId: filter.productId,
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
          include: {
            productSize: {
              include: {
                color: { include: { product: true } },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart.items;
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

    if (!productSize) throw new NotFoundException('Product variant not found');

    // console.log(productSize, 'productSize');

    const colorName = productSize.color.color.name;
    const sizeName = productSize.size.name;

    const quantityToAdd = dto.quantity ?? 1;

    if (productSize.quantity < quantityToAdd)
      throw new BadRequestException('Not enough stock');

    const unitPrice = productSize.price ?? productSize.color.product.basePrice;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productSizeId: productSize.id,
      },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantityToAdd;

      if (newQty > productSize.quantity)
        throw new BadRequestException('Stock limit exceeded');

      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQty,
          subtotal: newQty * existingItem.priceAtAdd,
        },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productSizeId: productSize.id,
        quantity: quantityToAdd,
        priceAtAdd: unitPrice,
        subtotal: unitPrice * quantityToAdd,
        color: colorName,
        size: sizeName,
      },
    });
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
}
