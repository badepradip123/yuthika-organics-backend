import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShipmentDto {
  @IsOptional() @IsString() @MaxLength(80) provider?: string;
  @IsOptional() @IsString() @MaxLength(120) trackingNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) status?: string;
  @IsOptional() @IsString() @MaxLength(300) trackingUrl?: string;
  @IsOptional() @IsDateString() estimatedDelivery?: string;
}
