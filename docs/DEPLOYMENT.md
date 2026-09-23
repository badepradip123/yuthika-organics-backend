# Production deployment checklist

## 1. Managed PostgreSQL

Create a production PostgreSQL database. Copy its connection string into `DATABASE_URL`.

## 2. Environment

Set:

- `NODE_ENV=production`
- `PORT=3000`
- `API_PREFIX=api/v1`
- `DATABASE_URL=...`
- `WEB_APP_URL=https://your-store-domain`
- `ADMIN_APP_URL=https://your-admin-domain`
- `JWT_SECRET=<long random value>`
- `JWT_REFRESH_SECRET=<different long random value>`
- `JWT_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=30d`
- `ENABLE_SWAGGER=false`
- `RAZORPAY_KEY_ID=...`
- `RAZORPAY_KEY_SECRET=...`
- `RAZORPAY_WEBHOOK_SECRET=...`
- `FREE_SHIPPING_THRESHOLD=999`
- `SHIPPING_FLAT_RATE=0`
- `COD_ENABLED=true`

## 3. Build

```bash
docker build -t yuthika-organics-backend .
```

## 4. Run

```bash
docker run --rm -p 3000:3000 --env-file .env.production yuthika-organics-backend
```

## 5. Health check

```bash
curl https://YOUR_API_DOMAIN/api/v1/health
```

## 6. Razorpay webhook

Configure Razorpay to call:

`POST https://YOUR_API_DOMAIN/api/v1/payments/razorpay/webhook`

Set the same webhook secret in `RAZORPAY_WEBHOOK_SECRET`.

## 7. Reverse proxy / platform

Your hosting provider should route HTTPS traffic to port 3000 and provide a health check using `/api/v1/health/live`.

## 8. Migrations

On deploy, run only:

```bash
npx prisma migrate deploy
```

Never run `prisma migrate dev` against production.
