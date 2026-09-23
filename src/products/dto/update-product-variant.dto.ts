import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateProductVariantDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(1) weightGrams?: number;
  @IsOptional() @IsString() @MaxLength(80) sku?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) mrp?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice?: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
