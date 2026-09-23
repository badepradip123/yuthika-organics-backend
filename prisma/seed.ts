import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const products = [
  { name: 'Cinnamon', slug: 'cinnamon', sku: 'YTH-CIN', basePrice: 149 },
  { name: 'Cloves', slug: 'cloves', sku: 'YTH-CLO', basePrice: 179 },
  { name: 'Green Cardamom', slug: 'green-cardamom', sku: 'YTH-GCA', basePrice: 299 },
  { name: 'Black Cardamom', slug: 'black-cardamom', sku: 'YTH-BCA', basePrice: 199 },
  { name: 'Black Pepper', slug: 'black-pepper', sku: 'YTH-BPE', basePrice: 169 },
  { name: 'Cumin Seeds', slug: 'cumin-seeds', sku: 'YTH-CUM', basePrice: 129 },
  { name: 'Coriander Seeds', slug: 'coriander-seeds', sku: 'YTH-COR', basePrice: 99 },
  { name: 'Fennel Seeds', slug: 'fennel-seeds', sku: 'YTH-FEN', basePrice: 109 },
  { name: 'Mustard Seeds', slug: 'mustard-seeds', sku: 'YTH-MUS', basePrice: 89 },
  { name: 'Fenugreek Seeds', slug: 'fenugreek-seeds', sku: 'YTH-FGR', basePrice: 89 },
  { name: 'Dry Red Chilli', slug: 'dry-red-chilli', sku: 'YTH-CHI', basePrice: 139 },
  { name: 'Raw Turmeric', slug: 'raw-turmeric', sku: 'YTH-TUR', basePrice: 119 },
  { name: 'Bay Leaf', slug: 'bay-leaf', sku: 'YTH-BAY', basePrice: 79 },
  { name: 'Star Anise', slug: 'star-anise', sku: 'YTH-STA', basePrice: 189 },
  { name: 'Mace', slug: 'mace', sku: 'YTH-MAC', basePrice: 349 },
  { name: 'Poppy Seeds', slug: 'poppy-seeds', sku: 'YTH-POP', basePrice: 399 },
  { name: 'Til', slug: 'til-sesame-seeds', sku: 'YTH-TIL', basePrice: 119 },
  { name: 'Shahi Jeera', slug: 'shahi-jeera', sku: 'YTH-SJE', basePrice: 179 },
] as const;

const packSizes = [
  { weightGrams: 100, multiplier: 1, stock: 40 },
  { weightGrams: 250, multiplier: 2.15, stock: 25 },
  { weightGrams: 500, multiplier: 4.05, stock: 15 },
  { weightGrams: 1000, multiplier: 7.6, stock: 8 },
];

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'whole-spices' },
    update: { name: 'Whole Spices', isActive: true },
    create: {
      name: 'Whole Spices',
      slug: 'whole-spices',
      description: 'Whole spices and traditional kitchen ingredients.',
      isActive: true,
      sortOrder: 1,
    },
  });

  for (const product of products) {
    const record = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        categoryId: category.id,
        status: 'ACTIVE',
        isFeatured: ['cinnamon', 'green-cardamom', 'black-pepper'].includes(product.slug),
      },
      create: {
        name: product.name,
        slug: product.slug,
        categoryId: category.id,
        shortDescription: `${product.name} - product content can be edited from the admin panel.`,
        description: `Premium ${product.name.toLowerCase()} for everyday cooking.`,
        status: 'ACTIVE',
        isFeatured: ['cinnamon', 'green-cardamom', 'black-pepper'].includes(product.slug),
      },
    });

    for (const pack of packSizes) {
      const price = Number((product.basePrice * pack.multiplier).toFixed(2));
      const sku = `${product.sku}-${pack.weightGrams}G`;
      const variant = await prisma.productVariant.upsert({
        where: { sku },
        update: {
          productId: record.id,
          weightGrams: pack.weightGrams,
          mrp: price,
          sellingPrice: price,
          isActive: true,
        },
        create: {
          productId: record.id,
          name: pack.weightGrams >= 1000 ? `${pack.weightGrams / 1000}kg` : `${pack.weightGrams}g`,
          weightGrams: pack.weightGrams,
          sku,
          mrp: price,
          sellingPrice: price,
          isActive: true,
          inventory: {
            create: { quantity: pack.stock, reservedQuantity: 0, lowStockThreshold: 5 },
          },
        },
      });
      await prisma.inventory.upsert({
        where: { variantId: variant.id },
        update: { quantity: pack.stock, reservedQuantity: 0 },
        create: {
          variantId: variant.id,
          quantity: pack.stock,
          reservedQuantity: 0,
          lowStockThreshold: 5,
        },
      });
    }
  }

  const adminEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: 'SUPER_ADMIN', isActive: true },
      create: {
        email: adminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        firstName: 'Super',
        lastName: 'Admin',
      },
    });
    console.log(`Super admin seeded: ${adminEmail}`);
  }

  console.log(`Seeded ${products.length} products with ${packSizes.length} pack sizes each.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
