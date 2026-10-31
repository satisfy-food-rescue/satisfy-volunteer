import { createHash, randomBytes } from "node:crypto";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "./database-url";

// Direct database access for arranging state the UI cannot reach, such as a
// sign-in link (whose raw token is only ever emailed).

async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Issues a sign-in link for `email` and returns its path. */
export async function issueSignInLink(email: string, purpose: "INVITE" | "PASSWORD_RESET" = "INVITE"): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  await withClient(async (c) => {
    const { rows } = await c.query<{ id: string }>(`SELECT id FROM "Volunteer" WHERE email = $1`, [email]);
    if (!rows[0]) throw new Error(`No volunteer ${email}`);
    await c.query(
      `INSERT INTO "AuthToken" (id, "tokenHash", "volunteerId", purpose, "expiresAt") VALUES ($1, $2, $3, $4, now() + interval '1 hour')`,
      [`e2e_${raw.slice(0, 12)}`, hash, rows[0].id, purpose],
    );
  });
  return `/reset-password?token=${raw}`;
}

/** The newest email to `email`, optionally of one kind. Seeded emails can be
 *  dated later today (a shift reminder at 4pm), so pass `kind` for anyone
 *  the demo data already writes to. */
export async function latestEmailTo(email: string, kind?: string) {
  return withClient(async (c) => {
    const { rows } = await c.query<{ kind: string; status: string; subject: string }>(
      `SELECT kind, status, subject FROM "Email" WHERE "toEmail" = $1 AND ($2::text IS NULL OR kind::text = $2) ORDER BY "createdAt" DESC LIMIT 1`,
      [email, kind ?? null],
    );
    return rows[0] ?? null;
  });
}

/** A volunteer of our own to do irreversible things to, so the demo people
 *  the other tests rely on are left alone. No password: sign in with a link. */
export async function createVolunteer(firstName: string, email: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO "Volunteer" (id, "firstName", "lastName", email, roles, "updatedAt") VALUES ($1, $2, 'Test', $3, ARRAY['WAREHOUSE']::"VolunteerRole"[], now())`,
      [`e2e_${randomBytes(6).toString("hex")}`, firstName, email],
    );
  });
}
