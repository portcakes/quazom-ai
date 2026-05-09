import { Resend } from "resend";

// Defer instantiation so importing the package never blows up at build time
// (e.g. during `next build` on a machine without RESEND_API_KEY set). Each
// caller hits this lazily and gets a clear error if the key is missing.
let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to the env of the calling app.",
    );
  }
  cached = new Resend(apiKey);
  return cached;
}

// "From" address used on every transactional send. Override per-app via env.
// Until you verify a domain in Resend, only `onboarding@resend.dev` will
// actually deliver to inboxes outside the Resend dashboard.
export function getFromAddress(): string {
  return process.env.EMAIL_FROM ?? "Quazom <onboarding@resend.dev>";
}

export function getReplyToAddress(): string | undefined {
  return process.env.EMAIL_REPLY_TO ?? undefined;
}
