# Yuthika Organics — Production Backend

Production-oriented ecommerce API for the Yuthika Organics web storefront, admin panel and React Native mobile app.

## Stack

- NestJS 11 + TypeScript
- PostgreSQL 16+
- Prisma 7
- JWT access + refresh tokens
- Role-based admin authorization
- Razorpay payment integration with server-side verification + webhook signature verification
- Cart, order, inventory and shipping/tracking APIs
- Swagger/OpenAPI in non-production by default
- Helmet, compression and global request throttling
- Docker deployment

## Feature coverage

- Public categories and product catalog
- Product search, filtering, sorting and pagination
- Admin product/category CRUD
- Product variants and inventory management
- Customer registration/login/logout/refresh/password change
- SUPER_ADMIN / PRODUCT_ADMIN / ORDER_MANAGER / INVENTORY_MANAGER / CUSTOMER roles
- Customer addresses
- Customer cart
- Order creation from cart
- COD and Razorpay flow
- Payment verification and webhook handling
- Inventory decrement on order and release on failed/cancelled online payment
- Admin order lifecycle and shipment/tracking records
- Admin dashboard metrics and user management
- Health/live endpoints

## Important production decisions

This project intentionally keeps two integrations provider-agnostic:

1. Product image storage is URL-based. Add S3/Cloudinary once the client chooses the storage provider.
2. Shipping uses an internal Shipment record. Connect a courier provider later without changing the web/mobile API contract.

## Quick start

```bash
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

API: `http://localhost:3000/api/v1`
Docs: `http://localhost:3000/docs`

## Existing Yuthika database

If you are replacing the current incremental backend, do not blindly run a fresh `init` migration against an existing database. First back up the database, compare the generated Prisma schema with the current schema, then create a migration for the differences.

The main additive production fields are:
- `users.refreshTokenHash`
- `carts`
- `cart_items`
- `shipments`

See `docs/EXISTING_DB_UPGRADE.md`.

## Production deployment

Use a managed PostgreSQL database and run the application as a Docker container.

Required production environment variables are documented in `.env.example`. Use long random JWT secrets and keep Razorpay secrets server-side only.

The container runs:

```bash
npx prisma migrate deploy
node dist/main.js
```

Do not use `prisma migrate dev` in production.
