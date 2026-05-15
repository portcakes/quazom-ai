import "server-only";

import prisma from "@quazom-ai/db";

import {
  findPlanByProductId,
  type BillingInterval,
  type PlanKey,
} from "./plans";
import { titleForPlanUpgrade } from "./titles";

/**
 * Handlers wired into the Polar `webhooks()` plugin in `lib/auth.ts`.
 *
 * Why we do this server-side instead of trusting the client's checkout
 * success page: the success URL fires once and only on a happy redirect,
 * but subscriptions can become active later (3DS challenge, async payment,
 * recovered card) or get cancelled / revoked entirely. Mirroring those
 * lifecycle events into the User row keeps `subscriptionPlan` honest for
 * the limit guards and the sidebar title even when the user never returns
 * to /success.
 */

type SubscriptionLike = {
  customerId: string;
  productId: string;
  recurringInterval: string;
  status: string;
  customer: { externalId?: string | null; id: string };
  cancelAtPeriodEnd?: boolean;
};

type WebhookWithSubscriptionData = {
  data: SubscriptionLike;
};

function pickIntervalFromString(raw: string): BillingInterval | null {
  if (raw === "month") return "MONTH";
  if (raw === "year") return "YEAR";
  return null;
}

function isActiveStatus(status: string): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Apply a subscription update to the matching User row.
 *
 * Plan + interval are mirrored down for active subscriptions and cleared
 * for revoked ones. The user's first activation on a paid plan also
 * unlocks the corresponding founding-tier title (idempotent — re-runs
 * leave the array unchanged).
 *
 * Errors are logged and swallowed: webhooks retry on failure but a hard
 * throw turns the rest of the polar handler chain into a 500, which we'd
 * rather not do for "user got renamed" type updates.
 */
async function syncSubscription(sub: SubscriptionLike): Promise<void> {
  const product = findPlanByProductId(sub.productId);
  if (!product) {
    console.warn("[polar] subscription for unknown productId", {
      productId: sub.productId,
      subscriptionStatus: sub.status,
    });
    return;
  }

  // Locate the user. `externalId` is the Better-Auth user id (set by the
  // polar plugin's create-customer hook); `polarCustomerId` is our cached
  // mirror for the cases where externalId hasn't propagated yet.
  const externalId = sub.customer.externalId?.trim();
  const user = await prisma.user.findFirst({
    where: externalId
      ? { OR: [{ id: externalId }, { polarCustomerId: sub.customer.id }] }
      : { polarCustomerId: sub.customer.id },
    select: {
      id: true,
      polarCustomerId: true,
      subscriptionPlan: true,
      earnedTitles: true,
      selectedTitle: true,
    },
  });
  if (!user) {
    console.warn("[polar] subscription event has no matching user", {
      customerId: sub.customer.id,
      externalId,
      productId: sub.productId,
    });
    return;
  }

  const interval =
    pickIntervalFromString(sub.recurringInterval) ?? null;
  const isActive = isActiveStatus(sub.status);
  const targetPlan: PlanKey | null = isActive ? product.plan.key : null;

  // Award the founding-tier title the first time a user lands on this
  // plan inside the founding window. Re-activations after the cutoff are
  // still grandfathered if the user had earned it before.
  const newEarned = new Set<string>(user.earnedTitles);
  let nextSelected = user.selectedTitle;
  if (isActive) {
    const slug = titleForPlanUpgrade(product.plan.key);
    if (slug && !newEarned.has(slug)) {
      newEarned.add(slug);
      // First title earned auto-pins so the badge shows up in the sidebar
      // without an extra click. Subsequent earned titles leave the
      // selection alone — the user picks via Settings.
      if (!nextSelected) nextSelected = slug;
    }
  }

  const earnedArray = Array.from(newEarned);
  const earnedChanged =
    earnedArray.length !== user.earnedTitles.length ||
    earnedArray.some((slug) => !user.earnedTitles.includes(slug));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionPlan: targetPlan,
      subscriptionInterval: targetPlan ? interval : null,
      // Cache the polar customer id whenever we see it so future updates
      // can short-circuit the externalId lookup.
      polarCustomerId: user.polarCustomerId ?? sub.customer.id,
      ...(earnedChanged ? { earnedTitles: earnedArray } : {}),
      ...(nextSelected !== user.selectedTitle
        ? { selectedTitle: nextSelected }
        : {}),
    },
  });
}

export async function onSubscriptionCreated(
  payload: WebhookWithSubscriptionData,
): Promise<void> {
  await syncSubscription(payload.data as SubscriptionLike);
}

export async function onSubscriptionUpdated(
  payload: WebhookWithSubscriptionData,
): Promise<void> {
  await syncSubscription(payload.data as SubscriptionLike);
}

export async function onSubscriptionActive(
  payload: WebhookWithSubscriptionData,
): Promise<void> {
  await syncSubscription(payload.data as SubscriptionLike);
}

export async function onSubscriptionCanceled(
  payload: WebhookWithSubscriptionData,
): Promise<void> {
  // Polar sends `subscription.canceled` when the user clicks "cancel" in
  // the customer portal — the subscription is still active until the
  // current period end. We mirror the subscription as-is (it'll have
  // cancelAtPeriodEnd=true and status='active') so the user keeps their
  // perks until Polar fires `subscription.revoked`.
  await syncSubscription(payload.data as SubscriptionLike);
}

export async function onSubscriptionRevoked(
  payload: WebhookWithSubscriptionData,
): Promise<void> {
  // Final revocation — the user no longer has access. Status will be
  // `canceled` (or similar) which `isActiveStatus` returns false for, so
  // the sync clears `subscriptionPlan`.
  await syncSubscription(payload.data as SubscriptionLike);
}
