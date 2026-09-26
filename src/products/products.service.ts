import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateImagesDto } from './dto/update-images.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { toPublicProduct } from './mappers/product-public.mapper';

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const productInclude = {
  category: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  variants: {
    where: { isActive: true },
    orderBy: { weightGrams: 'asc' as const },
    include: { inventory: true },
  },
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListProductsDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      ...(query.isFeatured === undefined ? {} : { isFeatured: query.isFeatured }),
      ...(query.category
        ? { category: { OR: [{ id: query.category }, { slug: query.category }], isActive: true } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { shortDescription: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: productInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((item) => toPublicProduct(item as Parameters<typeof toPublicProduct>[0])),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async findOne(id: string, publicOnly = true) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product || (publicOnly && product.status !== 'ACTIVE'))
      throw new NotFoundException('Product not found');
    return publicOnly ? toPublicProduct(product as Parameters<typeof toPublicProduct>[0]) : product;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
    if (!product || product.status !== 'ACTIVE') throw new NotFoundException('Product not found');
    return toPublicProduct(product as Parameters<typeof toPublicProduct>[0]);
  }

  async findAdminList(query: ListProductsDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ProductWhereInput = {
      ...(query.isFeatured === undefined ? {} : { isFeatured: query.isFeatured }),
      ...(query.category
        ? { category: { OR: [{ id: query.category }, { slug: query.category }] } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          ...productInclude,
          variants: { orderBy: { weightGrams: 'asc' }, include: { inventory: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug?.trim() || toSlug(dto.name);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.findFirst({
          where: { id: dto.categoryId, isActive: true },
        });
        if (!category) throw new NotFoundException('Active category not found');
        const product = await tx.product.create({
          data: {
            name: dto.name.trim(),
            slug,
            categoryId: dto.categoryId,
            shortDescription: dto.shortDescription,
            description: dto.description,
            isFeatured: dto.isFeatured ?? false,
            status: 'DRAFT',
            images: dto.images?.length
              ? { create: dto.images.map((url, index) => ({ url, sortOrder: index })) }
              : undefined,
            variants: {
              create: dto.variants.map((variant) => ({
                name: variant.name ?? `${variant.weightGrams}g`,
                weightGrams: variant.weightGrams,
                sku: variant.sku,
                mrp: variant.mrp,
                sellingPrice: variant.sellingPrice,
                inventory: {
                  create: {
                    quantity: variant.stock ?? 0,
                    reservedQuantity: 0,
                    lowStockThreshold: variant.lowStockThreshold ?? 5,
                  },
                },
              })),
            },
          },
          include: {
            ...productInclude,
            variants: { orderBy: { weightGrams: 'asc' }, include: { inventory: true } },
          },
        });
        return product;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Product slug or SKU already exists');
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id, false);
    try {
      return await this.prisma.product.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug: dto.slug ? toSlug(dto.slug) : undefined,
          categoryId: dto.categoryId,
          shortDescription: dto.shortDescription,
          description: dto.description,
          isFeatured: dto.isFeatured,
        },
        include: {
          ...productInclude,
          variants: { orderBy: { weightGrams: 'asc' }, include: { inventory: true } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Product slug already exists');
      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdateProductStatusDto) {
    await this.findOne(id, false);
    return this.prisma.product.update({ where: { id }, data: { status: dto.status } });
  }

  async updateImageUrl(
  productId: string,
  imageUrl: string,
) {
  return this.prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      imageUrl,
    },
  });
}

  async archive(id: string) {
    return this.updateStatus(id, { status: 'INACTIVE' });
  }

  async replaceImages(id: string, dto: UpdateImagesDto) {
    await this.findOne(id, false);
    return this.prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (dto.urls.length) {
        await tx.productImage.createMany({
          data: dto.urls.map((url, index) => ({
            productId: id,
            url,
            altText: dto.altTexts?.[index] ?? null,
            sortOrder: index,
          })),
        });
      }
      return tx.product.findUnique({
        where: { id },
        include: { images: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    await this.findOne(productId, false);
    try {
      return await this.prisma.productVariant.create({
        data: {
          productId,
          name: dto.name ?? `${dto.weightGrams}g`,
          weightGrams: dto.weightGrams,
          sku: dto.sku,
          mrp: dto.mrp,
          sellingPrice: dto.sellingPrice,
          inventory: {
            create: {
              quantity: dto.stock ?? 0,
              reservedQuantity: 0,
              lowStockThreshold: dto.lowStockThreshold ?? 5,
            },
          },
        },
        include: { inventory: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('SKU already exists');
      throw error;
    }
  }

  async updateVariant(variantId: string, dto: UpdateProductVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.productVariant.update({
          where: { id: variantId },
          data: {
            name: dto.name,
            weightGrams: dto.weightGrams,
            sku: dto.sku,
            mrp: dto.mrp,
            sellingPrice: dto.sellingPrice,
            isActive: dto.isActive,
          },
        });
        if (dto.stock !== undefined || dto.lowStockThreshold !== undefined) {
          await tx.inventory.upsert({
            where: { variantId },
            update: { quantity: dto.stock, lowStockThreshold: dto.lowStockThreshold },
            create: {
              variantId,
              quantity: dto.stock ?? 0,
              reservedQuantity: 0,
              lowStockThreshold: dto.lowStockThreshold ?? 5,
            },
          });
        }
        return tx.productVariant.findUnique({
          where: { id: updated.id },
          include: { inventory: true },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('SKU already exists');
      throw error;
    }
  }

  async updateInventory(variantId: string, dto: UpdateInventoryDto) {
    const inventory = await this.prisma.inventory.findUnique({ where: { variantId } });
    if (!inventory) throw new NotFoundException('Inventory not found');
    if (dto.quantity < inventory.reservedQuantity)
      throw new ConflictException('Quantity cannot be less than reserved stock');
    return this.prisma.inventory.update({
      where: { variantId },
      data: { quantity: dto.quantity, lowStockThreshold: dto.lowStockThreshold },
    });
  }
}
