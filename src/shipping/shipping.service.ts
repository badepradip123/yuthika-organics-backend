import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async getByOrderForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.shipment.findUnique({ where: { orderId } });
  }

  async upsertForAdmin(orderId: string, dto: UpdateShipmentDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const shipment = await this.prisma.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        provider: dto.provider,
        trackingNumber: dto.trackingNumber,
        status: dto.status ?? 'CREATED',
        trackingUrl: dto.trackingUrl,
        estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : undefined,
      },
      update: {
        provider: dto.provider,
        trackingNumber: dto.trackingNumber,
        status: dto.status,
        trackingUrl: dto.trackingUrl,
        estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : undefined,
        shippedAt: dto.status === 'SHIPPED' ? new Date() : undefined,
        deliveredAt: dto.status === 'DELIVERED' ? new Date() : undefined,
      },
    });

    if (dto.status === 'SHIPPED')
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'SHIPPED' } });
    if (dto.status === 'OUT_FOR_DELIVERY')
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'OUT_FOR_DELIVERY' },
      });
    if (dto.status === 'DELIVERED')
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });

    return shipment;
  }
}
