import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateImagesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  urls!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  altTexts?: string[];
}
