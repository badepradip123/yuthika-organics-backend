# SKILLS.md

## Backend

Use NestJS modules with controller -> service -> Prisma layering. Keep business rules in services, not controllers.

## Prisma

Use transactions around order creation, inventory changes and payment state changes. Treat Decimal money values as numbers only at API boundaries.

## Ecommerce

- Validate inventory on every checkout.
- Never calculate final price from browser-submitted prices.
- Snapshot product name, variant name, SKU and price into OrderItem.
- Keep order state transitions explicit.
- Make cancellation/payment failure inventory-safe and idempotent.

## Security

- JWT access + refresh tokens.
- Hash passwords and refresh tokens with bcrypt.
- Do not log secrets.
- Use Helmet, CORS allowlists and request throttling.
- Keep payment webhook secrets server-side.
