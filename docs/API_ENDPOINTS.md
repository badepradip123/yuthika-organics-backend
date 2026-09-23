# Main API endpoints

## Public

- `GET /api/v1/health`
- `GET /api/v1/health/live`
- `GET /api/v1/categories`
- `GET /api/v1/categories/:id`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `GET /api/v1/products/slug/:slug`

## Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`

## Customer

- `GET/POST/PATCH/DELETE /api/v1/addresses`
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart`
- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `PATCH /api/v1/orders/:id/cancel`
- `GET /api/v1/shipping/orders/:orderId`
- `GET /api/v1/payments/orders/:orderId`
- `POST /api/v1/payments/razorpay/verify`

## Admin

- Category CRUD
- Product CRUD/status/images
- Variant and inventory management
- Order list/detail/status
- Shipment/tracking management
- Dashboard metrics
- User/role management
- Razorpay webhook
