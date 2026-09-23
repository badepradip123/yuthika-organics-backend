# AGENTS.md — Yuthika Organics Backend

## Project rules

- Backend stack: NestJS + TypeScript + PostgreSQL + Prisma.
- Keep Prisma schema as the source of truth for persistence.
- Public endpoints must not expose password hashes, refresh token hashes, internal inventory controls or provider secrets.
- Admin mutations require JWT authentication and an explicit role.
- Prefer database transactions for order, payment and inventory changes.
- Never trust price, stock or discount values from the client during checkout.
- Order prices are always calculated from server-side ProductVariant values.
- Verify payment signatures server-side.
- Webhook handlers must be idempotent.
- Use DTO validation with whitelist + forbidNonWhitelisted.
- Do not use `db push` in production.
- Keep provider integrations behind service classes so Razorpay/shipping providers can be swapped.

## Roles

- SUPER_ADMIN — full administration
- PRODUCT_ADMIN — categories/products/variants
- ORDER_MANAGER — orders/shipping
- INVENTORY_MANAGER — inventory
- CUSTOMER — storefront customer

## Deployment pattern

Docker image -> managed PostgreSQL -> HTTPS reverse proxy/platform -> `/api/v1/health/live` health check.
