import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      variant: {
        include: {
          product: { select: { id: true, name: true, slug: true, status: true } },
          inventory: true,
        },
      },
    },
  },
};

type CartItemRow = {
  id: string;
  quantity: number;
  variantId: string;
  variant: {
    id: string;
    name: string | null;
    weightGrams: number;
    mrp: number | { toNumber(): number };
    sellingPrice: number | { toNumber(): number };
    inventory?: { quantity: number | null; reservedQuantity: number | null } | null;
    product: { id: string; name: string; slug: string; status: string };
  };
};

type CartWithItems = {
  id: string;
  items: CartItemRow[];
};

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: cartInclude,
    });
    return this.mapCart(cart as CartWithItems);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true, inventory: true },
    });
    if (!variant || !variant.isActive || variant.product.status !== 'ACTIVE')
      throw new NotFoundException('Product variant not available');
    const available =
      (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);
    if (dto.quantity > available)
      throw new ConflictException('Requested quantity is not available');

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: dto.variantId } },
    });
    const newQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (newQuantity > available)
      throw new ConflictException('Requested quantity exceeds available stock');

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: dto.variantId } },
      create: { cartId: cart.id, variantId: dto.variantId, quantity: dto.quantity },
      update: { quantity: newQuantity },
    });
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true, variant: { include: { inventory: true } } },
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundException('Cart item not found');
    const available =
      (item.variant.inventory?.quantity ?? 0) - (item.variant.inventory?.reservedQuantity ?? 0);
    if (dto.quantity > available)
      throw new ConflictException('Requested quantity exceeds available stock');
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!item || item.cart.userId !== userId) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }

  private mapCart(cart: CartWithItems) {
    let subtotal = 0;
    const items = cart.items.map((item: CartItemRow) => {
      const unitPrice = Number(item.variant.sellingPrice);
      const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotal += lineTotal;
      const available =
        (item.variant.inventory?.quantity ?? 0) - (item.variant.inventory?.reservedQuantity ?? 0);
      return {
        id: item.id,
        quantity: item.quantity,
        variantId: item.variantId,
        product: item.variant.product,
        variant: {
          id: item.variant.id,
          name: item.variant.name ?? `${item.variant.weightGrams}g`,
          weightGrams: item.variant.weightGrams,
          mrp: Number(item.variant.mrp),
          sellingPrice: unitPrice,
          inStock: available > 0,
          availableQuantity: Math.max(0, available),
        },
        lineTotal,
      };
    });
    return {
      id: cart.id,
      items,
      subtotal: Number(subtotal.toFixed(2)),
      itemCount: items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
    };
  }
}
