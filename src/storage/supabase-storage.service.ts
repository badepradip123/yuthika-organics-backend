import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket = 'product-images';

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      );
    }

    this.supabase = createClient(url, serviceRoleKey);
  }

  async uploadProductImage(
    productId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPG, PNG and WebP images are allowed',
      );
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      throw new BadRequestException(
        'Image size must be less than or equal to 5 MB',
      );
    }

    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    const extension = extensionMap[file.mimetype];

    const filePath = `products/${productId}/main-${Date.now()}.${extension}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Image upload failed: ${error.message}`,
      );
    }

    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}