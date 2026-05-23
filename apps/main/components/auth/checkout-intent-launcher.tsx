"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

/**
 * Tiny client-only mount that reads the `quazom_checkout_intent` cookie
 * (written by the register form when a Founding CTA on apps/web pointed
 * the user at `/register?plan=...&checkout=1`) and, if present, kicks off
 * the matching Polar checkout.
 *
 * The `/api/checkout-intent` GET handler clears the cookie as part of the
 * read so this can only fire once per session — a hot-reload remount, a
 * back navigation, or any other revisit of the (app)/ layout won't
 * re-trigger the checkout.
 *
 * Mounted inside `(app)/layout.tsx` so the launcher only runs once the
 * user has actually verified their email + finished onboarding (anything
 * inside `(app)/` already requires an authed session per `requireAuth`).
 */
export function CheckoutIntentLauncher() {
  // Strict-Mode in dev mounts effects twice; the cookie is single-use so
  // the second fetch will see nothing, but we also guard with a ref to
  // keep network calls predictable while debugging.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    async function maybeLaunchCheckout() {
      try {
        const res = await fetch("/api/checkout-intent", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) return;

        const json = (await res.json()) as
          | { intent: { plan: string; interval: string }; slug: string }
          | { intent: null };
        if (cancelled) return;
        if (!("slug" in json) || !json.slug) return;

        // `authClient.checkout` follows the Polar redirect, so the user
        // lands on the Polar-hosted checkout page (or comes back to
        // POLAR_SUCCESS_URL on completion). A failed launch logs + drops
        // the cookie so a second mount doesn't keep retrying.
        await authClient.checkout({ slug: json.slug });
      } catch (err) {
        if (cancelled) return;
        console.warn("[checkout-intent] launch failed", err);
        toast.error(
          "We couldn't open checkout automatically. You can upgrade from Settings → Subscription.",
        );
        // Belt-and-braces: the GET already cleared the cookie, but if the
        // fetch itself failed we still want to drop it so the launcher
        // doesn't loop on every page load.
        try {
          await fetch("/api/checkout-intent", {
            method: "DELETE",
            credentials: "include",
            cache: "no-store",
          });
        } catch {
          // best-effort
        }
      }
    }

    void maybeLaunchCheckout();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
