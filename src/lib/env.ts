import { z } from "zod";

// Runtime configuration, validated on first use rather than at import so that
// `next build` (which imports server modules with no real environment) still
// works. Nothing here is NEXT_PUBLIC_, so every value is read when the server
// runs: one Docker image serves the demo and production, configured by env.

const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  // Public origin, e.g. https://volunteer.satisfyfoodrescue.org.nz. Used for
  // links in emails, the Google redirect URI and the passkey relying party.
  APP_URL: z.url().default("http://localhost:3000"),
  // Sales demo: persona sign-in, demo data regenerated daily, nothing sent.
  DEMO_MODE: flag,
  RESEND_API_KEY: z.string().optional(),
  // "log" prints emails instead of sending them: for staging and the
  // end-to-end tests. Without RESEND_API_KEY, development behaves the same.
  EMAIL_DELIVERY: z.enum(["resend", "log"]).default("resend"),
  EMAIL_FROM: z.string().default("Satisfy Food Rescue <volunteers@satisfyfoodrescue.org.nz>"),
  // Where coordinator alerts go, and the reply-to on every volunteer email.
  COORDINATOR_EMAIL: z.email().default("volunteers@satisfyfoodrescue.org.nz"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Bearer token the scheduler presents to /api/cron/tick.
  CRON_SECRET: z.string().optional(),
  // Made an admin on boot while there is no active admin, so a fresh
  // database has someone who can sign in (via "first time here?" or Google).
  BOOTSTRAP_ADMIN_EMAIL: z.email().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().default("Coordinator"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  // An empty value (KEY= in .env, or a blank field in Coolify) means unset.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === "production" && !e.DEMO_MODE) {
    const missing = [
      !raw.APP_URL && "APP_URL",
      e.EMAIL_DELIVERY === "resend" && !e.RESEND_API_KEY && "RESEND_API_KEY",
      !e.CRON_SECRET && "CRON_SECRET",
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(`Missing production configuration: ${missing.join(", ")}`);
    }
  }
  cached = e;
  return e;
}

/** Public origin without a trailing slash. */
export function appOrigin(): string {
  return new URL(env().APP_URL).origin;
}

/** Turns an app-relative path into an absolute URL for emails. */
export function absoluteUrl(path: string): string {
  return new URL(path, appOrigin() + "/").toString();
}

export function isDemo(): boolean {
  return env().DEMO_MODE;
}

export function googleConfigured(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}
