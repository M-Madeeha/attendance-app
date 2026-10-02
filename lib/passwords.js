import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("scrypt:")) {
    return { ok: stored === password, legacy: true };
  }

  const [, salt, encoded] = stored.split(":");
  const actual = await scrypt(password, salt, KEY_LENGTH);
  const expected = Buffer.from(encoded, "hex");
  const ok = actual.length === expected.length && timingSafeEqual(actual, expected);
  return { ok, legacy: false };
}

export function createAuthToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashAuthToken(token) };
}

export function hashAuthToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
