import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateInventoryDto {
  @IsInt() @Min(0) quantity!: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}
