import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentMethod, PaymentStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createGatewayOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus === PaymentStatus.PAID) return { status: 'paid' };
    if (!order.payments.some((payment) => payment.provider === PaymentMethod.RAZORPAY))
      throw new BadRequestException('Razorpay payment is not configured for this order');

    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret)
      throw new ServiceUnavailableException('Online payment gateway is not configured');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(Number(order.totalAmount) * 100),
        currency: order.currency,
        receipt: order.orderNumber,
        notes: { orderId: order.id },
      }),
    });

    const data: {
      id?: string;
      amount?: number;
      currency?: string;
      error?: { description?: string };
    } = await response.json();
    if (!response.ok)
      throw new ServiceUnavailableException(
        data?.error?.description || 'Unable to create payment order',
      );

    const payment = await this.prisma.payment.findFirst({
      where: { orderId, provider: PaymentMethod.RAZORPAY },
    });
    if (!payment) throw new NotFoundException('Payment record not found');
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerOrderId: data.id, status: PaymentStatus.PENDING },
    });

    return { keyId, razorpayOrderId: data.id, amount: data.amount, currency: data.currency };
  }

  async verifyPayment(
    userId: string,
    orderId: string,
    razorpayPaymentId: string,
    razorpayOrderId: string,
    signature: string,
  ) {
    const ownedOrder = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, paymentStatus: true },
    });
    if (!ownedOrder) throw new NotFoundException('Order not found');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keySecret)
      throw new ServiceUnavailableException('Online payment gateway is not configured');
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, provider: PaymentMethod.RAZORPAY },
    });
    if (!payment?.providerOrderId || payment.providerOrderId !== razorpayOrderId)
      throw new BadRequestException('Payment order mismatch');

    const expected = createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    if (!safeEqual(expected, signature)) throw new BadRequestException('Invalid payment signature');

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: razorpayPaymentId,
          providerSignature: signature,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: PaymentStatus.PAID, status: 'CONFIRMED', placedAt: new Date() },
      });
    });
    return { success: true };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('Payment webhook is not configured');
    if (!signature) throw new BadRequestException('Missing webhook signature');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!safeEqual(expected, signature)) throw new BadRequestException('Invalid webhook signature');

    const payload: {
      event?: string;
      payload?: {
        payment?: { entity?: { order_id?: string; id?: string } };
        order?: { entity?: { id?: string } };
      };
    } = JSON.parse(rawBody.toString('utf8'));
    const event = payload.event;
    const entity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;
    const providerOrderId = entity?.order_id ?? orderEntity?.id;
    if (!providerOrderId) return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: { providerOrderId, provider: PaymentMethod.RAZORPAY },
    });
    if (!payment) return { received: true };

    if (event === 'payment.captured' || event === 'order.paid') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          providerPaymentId: entity?.id ?? payment.providerPaymentId,
          paidAt: new Date(),
        },
      });
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: PaymentStatus.PAID, status: 'CONFIRMED', placedAt: new Date() },
      });
    } else if (event === 'payment.failed') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerPaymentId: entity?.id ?? payment.providerPaymentId,
        },
      });
      await this.releaseInventoryAndCancel(payment.orderId);
    }

    return { received: true };
  }

  private async releaseInventoryAndCancel(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.status === 'CANCELLED' || order.paymentStatus === PaymentStatus.PAID)
        return;
      for (const item of order.items) {
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: { quantity: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', paymentStatus: PaymentStatus.FAILED },
      });
    });
  }

  async listByOrder(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
