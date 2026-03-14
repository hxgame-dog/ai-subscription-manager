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

## Security Notes

- API keys are encrypted server-side using envelope encryption.
- Only masked key values are ever returned to the UI.
- Every sensitive action is written to `audit_logs`.

## Cron

Vercel triggers `/api/cron/sync` every 2 hours. Add `CRON_SECRET` if you want to gate cron calls.
