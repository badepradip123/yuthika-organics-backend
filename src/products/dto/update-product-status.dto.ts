import { IsEnum } from 'class-validator';
import { ProductStatus } from '../../generated/prisma/client';

export class UpdateProductStatusDto {
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}
