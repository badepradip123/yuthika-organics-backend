# Upgrading the existing Yuthika database safely

The current Yuthika project already has users, addresses, products, variants, inventory, orders and payments.

Before production deployment:

1. Back up PostgreSQL.
2. Put the updated `prisma/schema.prisma` in the active backend.
3. Run `npx prisma generate`.
4. Compare the current database to the schema.
5. Create an additive migration locally with `npx prisma migrate dev --name production_features`.
6. Review the SQL migration file.
7. Test the migration on a database copy.
8. Commit `prisma/migrations/*` to Git.
9. Production uses `npx prisma migrate deploy`.

Do not use `db push` for production schema changes.
