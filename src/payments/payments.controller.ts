import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('razorpay/verify')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  verify(
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      orderId: string;
      razorpayPaymentId: string;
      razorpayOrderId: string;
      razorpaySignature: string;
    },
  ) {
    return this.service.verifyPayment(
      req.user.id,
      body.orderId,
      body.razorpayPaymentId,
      body.razorpayOrderId,
      body.razorpaySignature,
    );
  }

  @Get('orders/:orderId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: { user: { id: string } }, @Param('orderId') orderId: string) {
    return this.service.listByOrder(orderId, req.user.id);
  }

  @Post('razorpay/webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const result = await this.service.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
    return result;
  }
}
