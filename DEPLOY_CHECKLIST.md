# Deploy Checklist

This checklist is for deploying the project to Vercel with Neon as the database.

## Pre-Deploy

1. GitHub repository is created and the current code is pushed to `main`.
2. Vercel project is created from the GitHub repository.
3. Neon project and database are created.
4. Local checks pass:
   - `npm install`
   - `npm run build`
   - `npm run db:push`
   - `npm run db:seed`

## Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL`
  Use the Neon pooler connection string.
- `DIRECT_DATABASE_URL`
  Use the Neon direct connection string.
- `NEXTAUTH_URL`
  Example: `https://your-project.vercel.app`
- `NEXTAUTH_SECRET`
  Generate with `openssl rand -base64 32`
- `MASTER_ENCRYPTION_KEY`
  Generate with `openssl rand -base64 32`
- `CRON_SECRET`
  Generate with `openssl rand -base64 32`
- `EMAIL_FROM`
  Example: `noreply@yourdomain.com`
- `GOOGLE_CLIENT_ID`
  Required for Google login in production.
- `GOOGLE_CLIENT_SECRET`
  Required for Google login in production.

## Neon

1. Verify the database is healthy and accessible.
2. Confirm the credentials in both connection strings are correct.
3. Confirm Prisma tables were created successfully after `db:push`.
4. Confirm seed data exists in the `Provider` table.
5. Watch for connection or permission issues in Neon.

## Google OAuth

If using Google login in production:

1. Create an OAuth client in Google Cloud Console.
2. Add this redirect URI:
   - `https://your-project.vercel.app/api/auth/callback/google`
3. Add this local redirect URI for development:
   - `http://localhost:3000/api/auth/callback/google`
4. Confirm the consent screen is configured.
5. Confirm login does not fail with `redirect_uri_mismatch`.

## Vercel Deployment

1. Import the repository into Vercel as a Next.js project.
2. Add all required environment variables before deploying.
3. Deploy and confirm the build succeeds.
4. Open these routes and verify they load:
   - `/`
   - `/dashboard`
   - `/subscriptions`
   - `/credentials`
   - `/alerts`
   - `/usage`
5. Check Vercel function logs for Prisma or auth errors.

## Functional Checks

1. Create a subscription successfully.
2. Create an API key successfully.
3. Confirm the UI never shows the raw API key.
4. Create an alert rule successfully.
5. Trigger a manual sync from `/usage`.
6. Confirm data is written to:
   - `UsageRecord`
   - `SpendRecord`
   - `SyncJob`
7. Confirm sensitive actions write to `AuditLog`.

## Security Checks

1. No plaintext API keys exist in the database.
2. No plaintext API keys appear in logs.
3. `.env` is not committed to Git.
4. Secrets are configured only in Vercel and local environment files.
5. `CRON_SECRET` is set before enabling cron-driven sync.

## Cron Checks

1. [`vercel.json`](/Users/hxgame/Documents/Playground/vercel.json) is present in the deployed branch.
2. Vercel can call `/api/cron/sync`.
3. Cron creates `SyncJob` rows for users with active syncable credentials.
4. Vercel logs do not show `401` or `500` responses for cron calls.

## Known Gaps

1. Email sending is still a placeholder and does not deliver real emails yet.
2. Auto-sync currently uses a mock connector layer, not full official platform integrations.
3. The project should upgrade `next` to a patched version before production launch.
