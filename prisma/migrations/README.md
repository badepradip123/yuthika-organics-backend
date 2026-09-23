# Migration policy

This distribution intentionally does not include a destructive initial migration because the Yuthika Organics project already has an existing Prisma database and migration history in the user's active backend.

For a fresh database, create and review an initial migration with:

```bash
npx prisma migrate dev --name init
```

Commit the generated migration folder before production deployment.

For the existing Yuthika database, create an additive migration after schema comparison. See `docs/EXISTING_DB_UPGRADE.md`.
