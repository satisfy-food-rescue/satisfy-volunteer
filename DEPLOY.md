# Deploying on Coolify

Production runs as two Coolify resources on the same server as Fair Food: a Postgres database and the app, built from this repository's `Dockerfile`. A third, optional resource runs the sales demo from the same image.

The image has nothing environment-specific baked in. On start, the container applies pending migrations (`prisma migrate deploy`), then starts Next.js, which bootstraps the database and is ready to serve. The production domain is shown below as `volunteer.satisfyfoodrescue.org.nz`; substitute the real one once it is confirmed.

## 1. Database

New resource > Database > PostgreSQL 17. Keep it on the internal network (no public port). Turn on scheduled backups (daily, keep at least 14) to S3-compatible storage; Garage on the same server works but an off-server target is better. Copy the internal connection URL.

## 2. Email (Resend)

1. In Resend, add the sending domain (`satisfyfoodrescue.org.nz`) and add the DNS records it gives you (SPF, DKIM, and the return-path MX). Wait until it shows Verified.
2. Create an API key with "Sending access" for that domain only.
3. Decide the sender (`EMAIL_FROM`) and the coordinator inbox (`COORDINATOR_EMAIL`). Replies to any volunteer email go to the coordinator inbox.

## 3. Google sign-in (optional)

In Google Cloud Console: APIs & Services > OAuth consent screen (External, app name "Satisfy Volunteers", support email, logo), then Credentials > Create OAuth client ID > Web application. Authorised redirect URI: `https://volunteer.satisfyfoodrescue.org.nz/auth/google/callback`. Copy the client id and secret. Without them the Google button is simply hidden.

## 4. The app

New resource > Application > from this GitHub repository, branch `main`, build pack **Dockerfile**. Port 3000. Set the domain to `https://volunteer.satisfyfoodrescue.org.nz` (Coolify issues the TLS certificate).

Environment variables (runtime, not build arguments):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Internal URL from step 1 |
| `APP_URL` | `https://volunteer.satisfyfoodrescue.org.nz` (must match the domain: passkeys and links depend on it) |
| `RESEND_API_KEY` | From step 2 |
| `EMAIL_FROM` | e.g. `Satisfy Food Rescue <volunteers@satisfyfoodrescue.org.nz>` |
| `COORDINATOR_EMAIL` | e.g. `volunteers@satisfyfoodrescue.org.nz` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `BOOTSTRAP_ADMIN_EMAIL` | The coordinator's email (Phillipa). Only used while there is no active admin, so it is safe to leave set |
| `BOOTSTRAP_ADMIN_NAME` | e.g. `Phillipa` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From step 3, optional |

The app refuses to start in production without `APP_URL`, `RESEND_API_KEY` and `CRON_SECRET`, and says which one is missing in the deployment log.

Leave Coolify's health check on: the image's `HEALTHCHECK` calls `/api/health`. For uptime monitoring use `/api/health/ready`, which also checks the database.

Deploy. The log should end with `[bootstrap] created the starting routes, shift types and training modules` and `[bootstrap] created admin …` on the first boot.

## 5. Hourly jobs

In the app resource: Scheduled Tasks > Add.

- Name: `tick`
- Command: `node scripts/cron-tick.mjs`
- Frequency: `0 * * * *` (hourly)

It runs inside the app container, so it reaches the server on localhost with the same `CRON_SECRET`. A successful run logs `200 {"ok":true,…}` with what each job did. The jobs are idempotent, so running one by hand (Coolify's "Execute now") is always safe.

## 6. First sign-in

The bootstrap admin has no password. They open the site, choose "First time here? Set up your password", enter their email and follow the link. Or they use "Continue with Google" if Google is set up and the email is their Google account. From Sign-in and security (their name at the bottom of the sidebar) they can add a passkey.

They then add volunteers from Volunteers > Add volunteer, which emails each one an invite. Volunteers who were added without an invite can use "First time here?" themselves.

## Demo deployment (optional)

A second application from the same repository with:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A separate database (never production's) |
| `APP_URL` | The demo domain, e.g. `https://demo.volunteer.satisfyfoodrescue.org.nz` |
| `DEMO_MODE` | `1` |
| `CRON_SECRET` | Any random value |

No email or Google settings are needed: the demo never sends. It regenerates its data on every start, and the same hourly scheduled task regenerates it when the New Zealand date changes. The seed refuses to run against a database unless `DEMO_MODE` is on, so pointing the demo at production data by mistake fails rather than wiping it.

## Operations

- **Deploys** apply migrations before the new server starts. A migration that fails stops the deploy and the previous container keeps serving.
- **Rollback**: redeploy the previous commit in Coolify. Migrations are forward-only, so a rollback across a schema change needs the down step written by hand. Keep migrations additive (add, backfill, then remove in a later release) to avoid this.
- **Undelivered email** shows in Admin > Outbox under "Not delivered", with the provider's error. The hourly job retries for two days. A sign-in link that failed cannot be retried (links are never stored), so send a new one from the volunteer's profile.
- **Signing someone out everywhere**: deactivate them (Volunteers > profile > Account). Reactivating restores their account but not their regular slots.
- **Logs**: Coolify > the app > Logs. Email problems log as `[email]`, job failures as `[tick]`, sign-in problems as `[google]` or `[passkey]`.
