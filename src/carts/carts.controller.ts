import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartsService } from './carts.service';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartsController {
  constructor(private readonly service: CartsService) {}

  @Get() get(@Req() req: { user: { id: string } }) {
    return this.service.getCart(req.user.id);
  }
  @Post('items') add(@Req() req: { user: { id: string } }, @Body() dto: AddCartItemDto) {
    return this.service.addItem(req.user.id, dto);
  }
  @Patch('items/:itemId')
  update(
    @Req() req: { user: { id: string } },
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.service.updateItem(req.user.id, itemId, dto);
  }
  @Delete('items/:itemId') remove(@Req() req: { user: { id: string } }, @Param('itemId') itemId: string) {
    return this.service.removeItem(req.user.id, itemId);
  }
  @Delete() clear(@Req() req: { user: { id: string } }) {
    return this.service.clear(req.user.id);
  }
}
