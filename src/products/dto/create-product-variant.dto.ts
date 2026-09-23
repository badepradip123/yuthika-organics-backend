import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductVariantDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsInt() @Min(1) weightGrams!: number;
  @IsString() @MaxLength(80) sku!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) mrp!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice!: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}
