import { randomBytes } from "node:crypto";

// Defaults intentionally lean small/safe so the very first cron run on a
// fresh deploy can't accidentally drain the entire waitlist into a single
// Resend burst.
export const DEFAULT_INVITE_BATCH = 25;
export const DEFAULT_INVITE_TTL_DAYS = 14;

/**
 * Caps `override` (when set) at 500 and falls back to the `ALPHA_INVITE_BATCH`
 * env var, then the {@link DEFAULT_INVITE_BATCH} constant. Used by both the
 * weekly cron and any ad-hoc batch trigger.
 */
export function getInviteBatchSize(override?: number): number {
  if (typeof override === "number" && override > 0) {
    return Math.min(override, 500);
  }
  const fromEnv = Number(process.env.ALPHA_INVITE_BATCH);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(fromEnv, 500);
  }
  return DEFAULT_INVITE_BATCH;
}

/**
 * TTL in milliseconds for a minted alpha key. Driven by the
 * `ALPHA_INVITE_TTL_DAYS` env var (defaults to 14 days).
 */
export function getInviteTtlMs(): number {
  const fromEnv = Number(process.env.ALPHA_INVITE_TTL_DAYS);
  const days =
    Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_INVITE_TTL_DAYS;
  return days * 24 * 60 * 60 * 1000;
}

/**
 * URL-safe base32-ish keys grouped into 4-char chunks for legibility in the
 * alpha-invite email. The `QUAZOM-` prefix makes them recognisable at a
 * glance both in inbox previews and in the database.
 *
 * Alphabet omits visually-confusable characters (0/O/I/1).
 */
export function generateAlphaAccessKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const chars: string[] = [];
  for (const byte of bytes) {
    chars.push(alphabet[byte % alphabet.length]!);
  }
  const grouped: string[] = [];
  for (let i = 0; i < chars.length; i += 4) {
    grouped.push(chars.slice(i, i + 4).join(""));
  }
  return `QUAZOM-${grouped.join("-")}`;
}

/**
 * Resolves the base URL the admin / cron prepend to alpha-invite registration
 * links. Falls back to localhost so dev still works without env wiring.
 */
export function getRegisterBaseUrl(): string {
  return process.env.NEXT_PUBLIC_MAIN_URL ?? "http://localhost:3001";
}
