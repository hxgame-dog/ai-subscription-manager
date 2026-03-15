# AI Subscription Manager (Vercel + Neon)

A SaaS MVP to manage AI subscriptions, usage quotas, API keys, sync jobs, and alerts.

## Deployment Guide

See [`DEPLOY_CHECKLIST.md`](/Users/hxgame/Documents/Playground/DEPLOY_CHECKLIST.md) for the full Vercel + Neon launch checklist.

## Stack

- Next.js App Router
- Prisma + Neon Postgres
- NextAuth (Google + email-ready)
- Vercel Cron (`/api/cron/sync`)

## Quick Start

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run db:generate`
4. Push schema: `npm run db:push`
5. Seed sample providers: `npm run db:seed`
6. Start dev server: `npm run dev`

## Publish Helper

Use the helper below to add, commit, and push your current changes safely:

```bash
npm run publish -- "your commit message"
```

## Security Notes

- API keys are encrypted server-side using envelope encryption.
- Only masked key values are ever returned to the UI.
- Every sensitive action is written to `audit_logs`.

## Provider Sync Config

- `CURSOR_ADMIN_API_KEY`
  Enables real Cursor usage event sync from the official Admin API.
- `GEMINI_GCP_PROJECT_ID`
  Google Cloud project id for Gemini request-count monitoring.
- `GOOGLE_SERVICE_ACCOUNT_JSON`
  Service account JSON with Monitoring and BigQuery access.
- `GEMINI_BILLING_EXPORT_PROJECT_ID`
- `GEMINI_BILLING_EXPORT_DATASET`
- `GEMINI_BILLING_EXPORT_TABLE`
  Optional BigQuery billing export source for Gemini spend and billing-derived token estimates.

## Cron

Vercel triggers `/api/cron/sync` every 2 hours. Add `CRON_SECRET` if you want to gate cron calls.
