import { IsBoolean, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @IsOptional() @IsString() @MaxLength(50) label?: string;
  @IsString() @MaxLength(120) recipientName!: string;
  @IsPhoneNumber('IN') phone!: string;
  @IsString() @MaxLength(200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MaxLength(80) city!: string;
  @IsString() @MaxLength(80) state!: string;
  @IsString() @MaxLength(20) postalCode!: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
