import { cookies as nextCookies } from "next/headers";
import { z } from "zod";

import { PLANS, type PlanKey, type BillingInterval } from "@/lib/subscription/plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Short-lived (~30 min) cookie that survives the email-verification round
 * trip. The marketing site's Founding CTAs (apps/web pricing/homepage) point
 * users at `/register?plan=explorer|scholar&checkout=1`; the register form
 * POSTs the captured intent here so the in-app CheckoutIntentLauncher can
 * kick off a Polar checkout the first time the new account lands inside
 * the authenticated shell.
 */
const COOKIE_NAME = "quazom_checkout_intent";
const COOKIE_MAX_AGE_SECONDS = 60 * 30; // 30 minutes

const writeSchema = z.object({
  // We accept the lowercase ("explorer"/"scholar") form the URL uses and
  // normalise to the uppercase `PlanKey` the rest of the app expects.
  plan: z.enum(["explorer", "scholar"]),
  interval: z.enum(["month", "year"]).default("month"),
});

const intentSchema = z.object({
  plan: z.enum(["EXPLORER", "SCHOLAR"]),
  interval: z.enum(["MONTH", "YEAR"]),
});
type CheckoutIntent = z.infer<typeof intentSchema>;

function normaliseIntent(input: z.infer<typeof writeSchema>): CheckoutIntent {
  return {
    plan: input.plan === "scholar" ? "SCHOLAR" : "EXPLORER",
    interval: input.interval === "year" ? "YEAR" : "MONTH",
  };
}

/**
 * Resolve the matching Polar checkout slug for an intent. Returned so the
 * `CheckoutIntentLauncher` client can hand it straight to
 * `authClient.checkout({ slug })` without re-querying the catalogue.
 */
function slugForIntent(intent: CheckoutIntent): string {
  const plan = PLANS[intent.plan as PlanKey];
  const product = plan.pricing[intent.interval as BillingInterval];
  return product.slug;
}

/**
 * POST /api/checkout-intent — write the cookie. Called from the register
 * form before `authClient.signUp.email`. We never read the cookie out of
 * the request body so the user can't forge slugs that aren't in our
 * catalogue.
 */
export async function POST(request: Request) {
  let parsed: z.infer<typeof writeSchema>;
  try {
    const body: unknown = await request.json();
    parsed = writeSchema.parse(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid checkout intent.";
    return Response.json({ error: message }, { status: 400 });
  }
  const intent = normaliseIntent(parsed);

  const store = await nextCookies();
  store.set(COOKIE_NAME, JSON.stringify(intent), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return Response.json({ ok: true });
}

/**
 * GET /api/checkout-intent — read + clear in one shot. The cookie can only
 * fire a checkout once; clearing on read avoids double-launches if the
 * launcher remounts (e.g. on hot reload during dev).
 */
export async function GET() {
  const store = await nextCookies();
  const raw = store.get(COOKIE_NAME)?.value;
  // Always clear, even when malformed, so a bad value can't pin the user
  // in a loop.
  if (raw !== undefined) {
    store.delete(COOKIE_NAME);
  }
  if (!raw) return Response.json({ intent: null });

  try {
    const intent = intentSchema.parse(JSON.parse(raw));
    return Response.json({
      intent,
      slug: slugForIntent(intent),
    });
  } catch {
    return Response.json({ intent: null });
  }
}

/**
 * DELETE /api/checkout-intent — explicit "user changed their mind" path,
 * exposed so the launcher's catch branch can guarantee the cookie is
 * dropped even when the checkout call fails before redirect.
 */
export async function DELETE() {
  const store = await nextCookies();
  store.delete(COOKIE_NAME);
  return Response.json({ ok: true });
}
