import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateProductVariantDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsInt() @Min(1) weightGrams!: number;
  @IsString() @MaxLength(80) sku!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) mrp!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice!: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}

export class CreateProductDto {
  @IsString() @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(180) slug?: string;
  @IsString() categoryId!: string;
  @IsOptional() @IsString() @MaxLength(300) shortDescription?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants!: CreateProductVariantDto[];
}
