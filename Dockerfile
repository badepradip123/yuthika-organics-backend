FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json .prettierrc ./
COPY prisma ./prisma

# Prisma 7 config reads DATABASE_URL while generating the client.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx prisma generate

COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
