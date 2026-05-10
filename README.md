# PropertySales OS — Backend (Phase 1)

NestJS 10 + Prisma 5 + PostgreSQL 15 + Redis + BullMQ + Socket.IO.

## Prerequisites

- Node.js 20.x
- pnpm 9+
- Docker (for local Postgres + Redis)

## Quick start

1. Copy environment: `cp .env.example .env` and adjust secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `WS_SECRET` must be strong in production).

2. Start databases:

   ```bash
   docker compose up -d
   ```

3. Install and migrate:

   ```bash
   pnpm install
   pnpm prisma migrate dev --name init
   pnpm prisma db seed
   ```

   If you prefer schema push without migration history during prototyping:

   ```bash
   pnpm prisma db push
   pnpm prisma db seed
   ```

4. Run the API:

   ```bash
   pnpm dev
   ```

   - HTTP: `http://localhost:3001`
   - API prefix: `/api/v1`
   - Health: `GET http://localhost:3001/health` (no `/api/v1` prefix)
   - Swagger: `http://localhost:3001/api/docs`

## Database roles and RLS (production order)

1. Apply Prisma migrations (as migrator / superuser).
2. Run `scripts/create-roles.sql` (adjust passwords; run as superuser).
3. Run `scripts/apply-rls.sql` to enable tenant isolation policies.

**PgBouncer** must use `pool_mode = session` (not `transaction`) when using `set_config` for RLS.

## Tests

- Unit: `pnpm test`
- Typecheck: `pnpm tsc`
- E2E (requires Postgres + Redis from compose and env): `RUN_E2E=1 pnpm test:e2e`

## Twilio webhook

`POST /api/v1/messages/webhook/whatsapp` expects `application/x-www-form-urlencoded` body and a valid `x-twilio-signature` for `TWILIO_WEBHOOK_URL` and `TWILIO_AUTH_TOKEN`.
