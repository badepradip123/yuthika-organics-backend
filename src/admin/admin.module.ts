import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { StorageModule } from '@/storage/storage.module';
import { ProductsModule } from '@/products/products.module';

@Module({ 
     imports: [StorageModule, ProductsModule], // Add StorageModule to the imports array
    controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
