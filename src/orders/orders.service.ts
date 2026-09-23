import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, OrderStatus, PaymentMethod, PaymentStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const orderInclude = {
  shippingAddress: true,
  items: true,
  payments: { orderBy: { createdAt: 'desc' as const } },
  shipment: true,
};

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const supportedPaymentMethods: PaymentMethod[] = [PaymentMethod.COD, PaymentMethod.RAZORPAY];

    if (!supportedPaymentMethods.includes(dto.paymentMethod)) {
      throw new ConflictException('Only Razorpay and COD payments are currently supported');
    }
    if (
      dto.paymentMethod === PaymentMethod.COD &&
      this.config.get<string>('COD_ENABLED', 'true') !== 'true'
    ) {
      throw new ConflictException('Cash on delivery is disabled');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: dto.shippingAddressId, userId } });
      if (!address) throw new NotFoundException('Shipping address not found');

      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: { include: { variant: { include: { product: true, inventory: true } } } },
        },
      });
      if (!cart || cart.items.length === 0) throw new ConflictException('Cart is empty');

      let subtotal = 0;
      const orderItems: Array<{
        productId: string;
        variantId: string;
        productName: string;
        variantName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> = [];

      for (const item of cart.items) {
        const { variant } = item;
        if (!variant.isActive || variant.product.status !== 'ACTIVE' || !variant.inventory) {
          throw new ConflictException(`Product ${variant.product.name} is no longer available`);
        }

        const available = variant.inventory.quantity - variant.inventory.reservedQuantity;
        if (item.quantity > available)
          throw new ConflictException(`Insufficient stock for ${variant.product.name}`);

        const unitPrice = Number(variant.sellingPrice);
        const lineTotal = Number((unitPrice * item.quantity).toFixed(2));
        subtotal += lineTotal;

        const updated = await tx.inventory.updateMany({
          where: {
            variantId: variant.id,
            quantity: { gte: item.quantity + variant.inventory.reservedQuantity },
          },
          data: { quantity: { decrement: item.quantity } },
        });
        if (updated.count !== 1)
          throw new ConflictException(`Stock changed for ${variant.product.name}. Please retry.`);

        orderItems.push({
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          variantName: variant.name ?? `${variant.weightGrams}g`,
          sku: variant.sku,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
        });
      }

      subtotal = Number(subtotal.toFixed(2));
      const freeThreshold = Number(this.config.get<string>('FREE_SHIPPING_THRESHOLD', '999'));
      const shippingRate = Number(this.config.get<string>('SHIPPING_FLAT_RATE', '0'));
      const shippingAmount = subtotal >= freeThreshold ? 0 : shippingRate;
      const totalAmount = Number((subtotal + shippingAmount).toFixed(2));
      const orderNumber = await this.generateOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          shippingAddressId: dto.shippingAddressId,
          status:
            dto.paymentMethod === PaymentMethod.COD ? OrderStatus.CONFIRMED : OrderStatus.PENDING,
          paymentStatus:
            dto.paymentMethod === PaymentMethod.COD ? PaymentStatus.PENDING : PaymentStatus.CREATED,
          subtotal,
          shippingAmount,
          discountAmount: 0,
          totalAmount,
          notes: dto.notes,
          placedAt: dto.paymentMethod === PaymentMethod.COD ? new Date() : null,
          items: { create: orderItems },
          payments: {
            create: {
              provider: dto.paymentMethod,
              amount: totalAmount,
              currency: 'INR',
              status:
                dto.paymentMethod === PaymentMethod.COD
                  ? PaymentStatus.PENDING
                  : PaymentStatus.CREATED,
            },
          },
        },
        include: orderInclude,
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });

    if (dto.paymentMethod === PaymentMethod.COD) return result;

    try {
      const payment = await this.payments.createGatewayOrder(result.id);
      return { ...result, payment };
    } catch (error) {
      await this.cancelAndReleaseInventory(result.id, 'Payment initialization failed');
      throw error;
    }
  }

  async listMine(userId: string, query: ListOrdersDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getMine(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listAdmin(query: ListOrdersDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ...orderInclude,
          user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        ...orderInclude,
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (dto.status === order.status) return order;
    if (!allowedTransitions[order.status].includes(dto.status))
      throw new ConflictException(`Cannot change order from ${order.status} to ${dto.status}`);

    if (dto.status === OrderStatus.CANCELLED)
      return this.cancelAndReleaseInventory(id, 'Cancelled by admin');

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: orderInclude,
    });
  }

  async cancelMine(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PACKED,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new ConflictException('This order can no longer be cancelled');
    }
    return this.cancelAndReleaseInventory(id, 'Cancelled by customer');
  }

  async markPaidFromGateway(orderId: string, paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { orderId, provider: PaymentMethod.RAZORPAY },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === PaymentStatus.PAID)
        return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, providerPaymentId: paymentId, paidAt: new Date() },
      });
      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.CONFIRMED,
          placedAt: new Date(),
        },
        include: orderInclude,
      });
    });
  }

  async markPaymentFailed(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    if (order.paymentStatus === PaymentStatus.PAID) return order;
    await this.prisma.payment.updateMany({
      where: { orderId, provider: PaymentMethod.RAZORPAY, status: { not: PaymentStatus.PAID } },
      data: { status: PaymentStatus.FAILED },
    });
    return this.cancelAndReleaseInventory(orderId, 'Payment failed');
  }

  private async cancelAndReleaseInventory(orderId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.CANCELLED)
        return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
      const deliveryFlowStatuses: OrderStatus[] = [
        OrderStatus.SHIPPED,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.RETURNED,
      ];

      if (deliveryFlowStatuses.includes(order.status)) {
        throw new ConflictException('Order has already entered delivery flow');
      }

      for (const item of order.items) {
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: { quantity: { increment: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus:
            order.paymentStatus === PaymentStatus.PAID ? PaymentStatus.PAID : PaymentStatus.FAILED,
          notes: order.notes ? `${order.notes}\n${reason}` : reason,
        },
      });
      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    });
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const value = `YTH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const exists = await tx.order.findUnique({
        where: { orderNumber: value },
        select: { id: true },
      });
      if (!exists) return value;
    }
    throw new ConflictException('Could not generate a unique order number');
  }
}
