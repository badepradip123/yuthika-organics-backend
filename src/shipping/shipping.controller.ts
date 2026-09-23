import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly service: ShippingService) {}

  @Get('orders/:orderId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMine(@Req() req: { user: { id: string } }, @Param('orderId') orderId: string) {
    return this.service.getByOrderForUser(req.user.id, orderId);
  }

  @Put('admin/orders/:orderId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORDER_MANAGER)
  upsert(@Param('orderId') orderId: string, @Body() dto: UpdateShipmentDto) {
    return this.service.upsertForAdmin(orderId, dto);
  }
}
