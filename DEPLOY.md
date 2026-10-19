# Deploying on Coolify

Production runs as two Coolify resources on Satisfy's own server: a Postgres database and the app, built from this repository's `Dockerfile`. A third, optional resource runs the sales demo from the same image. The native app (`mobile/`) is built and shipped separately with EAS; see `mobile/README.md`.

The image has nothing environment-specific baked in. On start, the container applies pending migrations (`prisma migrate deploy`), then starts Next.js, which bootstraps the database and is ready to serve. The production domain is shown below as `volunteer.satisfyfoodrescue.org.nz`; substitute the real one once it is confirmed.

## 1. Database

New resource > Database > PostgreSQL 17. Keep it on the internal network (no public port). Turn on scheduled backups (daily, keep at least 14) to S3-compatible storage; Garage on the same server works but an off-server target is better. Copy the internal connection URL.

## 2. Email (Resend)

1. In Resend, add the sending domain (`satisfyfoodrescue.org.nz`) and add the DNS records it gives you (SPF, DKIM, and the return-path MX). Wait until it shows Verified.
2. Create an API key with "Sending access" for that domain only.
3. Decide the sender (`EMAIL_FROM`) and the coordinator inbox (`COORDINATOR_EMAIL`). Replies to any volunteer email go to the coordinator inbox.

## 3. Google sign-in (optional)

In Google Cloud Console > Google Auth Platform:

- **Branding**: app name "Satisfy Volunteers", support email, home page `https://volunteer.satisfyfoodrescue.org.nz`, privacy policy `https://volunteer.satisfyfoodrescue.org.nz/privacy`, terms of service `https://volunteer.satisfyfoodrescue.org.nz/terms`, authorised domain `satisfyfoodrescue.org.nz`. A logo makes Google verify the branding first, which takes a few days.
- **Audience**: External, then Publish app. While it is in testing only listed test users can sign in.
- **Data access**: nothing to add. The app asks only for `openid` and `email`, which need no review.
- **Clients** > Create client > Web application. Authorised redirect URI: `https://volunteer.satisfyfoodrescue.org.nz/auth/google/callback`. Copy the client id and secret straight away: Google shows the secret only once.

Without them the Google button is simply hidden, on the website and in the app. For local development, make a second web client with the redirect URI `http://localhost:3000/auth/google/callback` rather than adding localhost to the production one.

The native app uses this same web client: it opens the website's Google sign-in in the system browser, which hands back to the app. No iOS or Android OAuth clients are needed.

## 4. Passkeys in the native app (optional)

Passkeys made on the website work in the app and the other way round, once each platform knows the app belongs to the site:

- **iOS**: set `APPLE_TEAM_ID` (Apple Developer > Membership). The site then serves `/.well-known/apple-app-site-association`, and an iOS build made with `EXPO_PUBLIC_API_URL=https://volunteer.satisfyfoodrescue.org.nz` declares `webcredentials:volunteer.satisfyfoodrescue.org.nz`. The App ID needs the Associated Domains capability (EAS turns it on when it syncs capabilities).
- **Android**: set `ANDROID_CERT_FINGERPRINTS` to the SHA-256 fingerprints of the upload key (`eas credentials`) and of Google Play's app signing key (Play Console > Test and release > App integrity), comma-separated. The site then serves `/.well-known/assetlinks.json`, and the server accepts passkey responses from the app.

Without them the app hides its passkey button and volunteers sign in with a password or Google.

## 5. The app

New resource > Application > from this GitHub repository, branch `main`, build pack **Dockerfile**. Port 3000. Set the domain to `https://volunteer.satisfyfoodrescue.org.nz` (Coolify issues the TLS certificate).

Environment variables (runtime, not build arguments):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Internal URL from step 1 |
| `APP_URL` | `https://volunteer.satisfyfoodrescue.org.nz` (must match the domain: passkeys and links depend on it) |
| `RESEND_API_KEY` | From step 2 |
| `EMAIL_FROM` | e.g. `Satisfy Food Rescue <volunteering@satisfyfoodrescue.org.nz>` |
| `COORDINATOR_EMAIL` | e.g. `volunteering@satisfyfoodrescue.org.nz` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `BOOTSTRAP_ADMIN_EMAIL` | The coordinator's email (Phillipa). Only used while there is no active admin, so it is safe to leave set |
| `BOOTSTRAP_ADMIN_NAME` | e.g. `Phillipa` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From step 3, optional |
| `APPLE_TEAM_ID`, `ANDROID_CERT_FINGERPRINTS` | From step 4, optional |
| `EXPO_ACCESS_TOKEN` | Only if the Expo project has enhanced push security turned on |

The app refuses to start in production without `APP_URL`, `RESEND_API_KEY` and `CRON_SECRET`, and says which one is missing in the deployment log.

Leave Coolify's health check on: the image's `HEALTHCHECK` calls `/api/health`. For uptime monitoring use `/api/health/ready`, which also checks the database.

Deploy. The log should end with `[bootstrap] created the starting routes, shift types and training modules` and `[bootstrap] created admin …` on the first boot.

## 6. Hourly jobs

In the app resource: Scheduled Tasks > Add.

- Name: `tick`
- Command: `node scripts/cron-tick.mjs`
- Frequency: `0 * * * *` (hourly)

It runs inside the app container, so it reaches the server on localhost with the same `CRON_SECRET`. A successful run logs `200 {"ok":true,…}` with what each job did. The jobs are idempotent, so running one by hand (Coolify's "Execute now") is always safe.

## 7. First sign-in

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

No email or Google settings are needed: the demo never sends email. Push notifications do reach phones signed in to the demo in the native app, which is how it is shown to people. It regenerates its data on every start, and the same hourly scheduled task regenerates it when the New Zealand date changes. The seed refuses to run against a database unless `DEMO_MODE` is on, so pointing the demo at production data by mistake fails rather than wiping it.

## Operations

- **Deploys** apply migrations before the new server starts. A migration that fails stops the deploy and the previous container keeps serving.
- **Rollback**: redeploy the previous commit in Coolify. Migrations are forward-only, so a rollback across a schema change needs the down step written by hand. Keep migrations additive (add, backfill, then remove in a later release) to avoid this.
- **Undelivered email and push** shows in Admin > Outbox under "Not delivered", with the provider's error. The hourly job retries for two days. A sign-in link that failed cannot be retried (links are never stored), so send a new one from the volunteer's profile.
- **Signing someone out everywhere**: deactivate them (Volunteers > profile > Account). Reactivating restores their account but not their regular slots.
- **Logs**: Coolify > the app > Logs. Email problems log as `[email]`, job failures as `[tick]`, sign-in problems as `[google]` or `[passkey]`.
