import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

// Password hashing, kept free of Next.js imports so scripts (the seed) can use it.

const BCRYPT_ROUNDS = 12;

// A bcrypt hash of a random string, compared against when an account has no
// password so a failed sign-in takes the same time either way.
let dummyHash: Promise<string> | null = null;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Always runs bcrypt, even with no stored hash, so timing does not reveal
 *  whether an account has a password. */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), BCRYPT_ROUNDS);
  const ok = await bcrypt.compare(password, hash ?? (await dummyHash));
  return ok && hash !== null;
}
