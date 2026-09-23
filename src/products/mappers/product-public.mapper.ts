interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}
interface ProductInventory {
  quantity: number;
  reservedQuantity: number;
}
interface ProductVariant {
  id: string;
  name: string | null;
  weightGrams: number;
  sku?: string;
  mrp: { toNumber(): number };
  sellingPrice: { toNumber(): number };
  isActive: boolean;
  inventory?: ProductInventory | null;
}
interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}
interface ProductWithRelations {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  isFeatured: boolean;
  category: ProductCategory;
  images: ProductImage[];
  variants: ProductVariant[];
}

export function toPublicProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    isFeatured: product.isFeatured,
    category: { id: product.category.id, name: product.category.name, slug: product.category.slug },
    images: [...product.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => ({ id: image.id, url: image.url, altText: image.altText })),
    variants: product.variants.map((variant) => {
      const available =
        (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0);
      const mrp = variant.mrp.toNumber();
      const sellingPrice = variant.sellingPrice.toNumber();
      const discountPercentage =
        mrp > 0 ? Math.max(0, Math.round(((mrp - sellingPrice) / mrp) * 100)) : 0;
      return {
        id: variant.id,
        name: variant.name ?? `${variant.weightGrams}g`,
        weightGrams: variant.weightGrams,
        mrp,
        sellingPrice,
        discountPercentage,
        inStock: available > 0,
      };
    }),
  };
}
