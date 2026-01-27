/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from './dto/addCartItem.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  // get all carts
  async getCartItems(userId: number) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        items: {
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
    // console.log(cart.items, 'cartitems');
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
    console.log(userId, 'userId');
    console.log('DTO received:', dto);

    const cart = await this.getOrCreateCart(userId);

    const productSize = await this.prisma.productSize.findUnique({
      where: { id: dto.productSizeId },
      include: {
        color: { include: { product: true } },
      },
    });

    if (!productSize) throw new NotFoundException('Product variant not found');

    if (productSize.quantity <= 0)
      throw new BadRequestException('This product variant is out of stock');

    const quantityToAdd = dto.quantity ?? 1;

    const existingItem = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productSizeId: productSize.id },
    });

    if (existingItem) {
      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: { increment: quantityToAdd },
          subtotal: {
            increment:
              (productSize.price ?? productSize.color.product.basePrice) *
              quantityToAdd,
          },
        },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productSizeId: productSize.id,
        quantity: quantityToAdd,
        priceAtAdd: productSize.price ?? productSize.color.product.basePrice,
        subtotal:
          (productSize.price ?? productSize.color.product.basePrice) *
          quantityToAdd,
      },
    });
  }

  // checkout cart
  async checkoutCart(userId: number) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

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
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (!cart) {
      return 0;
    }

    const itemCount = await this.prisma.cartItem.count({
      where: { cartId: cart.id },
    });
    return itemCount;
  }
}
