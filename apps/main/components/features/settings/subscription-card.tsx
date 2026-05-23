"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ExternalLinkIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quazom-ai/ui/components/ui/card";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@quazom-ai/ui/components/ui/toggle-group";
import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";

type Interval = "MONTH" | "YEAR";

const FOUNDING_CUTOFF_LABEL = "until July 7, 2026 (midnight ET)";

// Friendly headline shown above the upgrade cards. Falls back gracefully
// when the user is on a paid plan and doesn't need an upsell.
function planHeadline(args: {
  isAlpha: boolean;
  paidPlan: string | null;
  interval: string | null;
}): string {
  if (args.paidPlan === "SCHOLAR") {
    return "You're on Scholar — thank you for supporting Quazom.";
  }
  if (args.paidPlan === "EXPLORER") {
    return "You're on Explorer. Upgrade to Scholar for unlimited generation.";
  }
  if (args.isAlpha) {
    return "You're on the Open Alpha plan. Upgrade to unlock more generations and earn a founding-tier title.";
  }
  return "Pick a plan to extend your generation limits.";
}

function intervalLabel(interval: Interval): string {
  return interval === "MONTH" ? "Monthly" : "Yearly";
}

function intervalSuffix(interval: Interval): string {
  return interval === "MONTH" ? "/mo" : "/yr";
}

// Yearly is exactly 20× the monthly price for Explorer ($5 → $100) and
// 10× for Scholar ($15 → $150). The pretty difference (months saved) is
// what we surface to the user.
function savingsCopy(
  interval: Interval,
  monthly: number,
  yearly: number,
): string | null {
  if (interval !== "YEAR") return null;
  const annualisedMonthly = monthly * 12;
  if (annualisedMonthly <= yearly) return null;
  const months = Math.round((annualisedMonthly - yearly) / monthly);
  return months > 0 ? `Save ${months} months a year` : null;
}

function asInterval(value: string | null | undefined): Interval | null {
  return value === "MONTH" || value === "YEAR" ? value : null;
}

export function SubscriptionCard() {
  const trpc = useTRPC();
  const subscriptionQuery = useQuery(trpc.getSubscription.queryOptions());
  const [interval, setInterval] = useState<Interval>("MONTH");
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState(false);

  const data = subscriptionQuery.data;
  const headline = useMemo(
    () =>
      planHeadline({
        isAlpha: data?.isAlpha ?? false,
        paidPlan: data?.paidPlan ?? null,
        interval: data?.interval ?? null,
      }),
    [data?.isAlpha, data?.paidPlan, data?.interval],
  );
  const currentInterval = asInterval(data?.interval);

  const handleCheckout = async (slug: string) => {
    try {
      setPendingSlug(slug);
      // The polar checkout endpoint replies with a redirect by default.
      // The Better Auth fetch client follows the redirect and lands the
      // user on the Polar-hosted checkout page automatically.
      await authClient.checkout({ slug });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't open checkout. Please try again.",
      );
      setPendingSlug(null);
    }
  };

  const handlePortal = async () => {
    try {
      setPortalPending(true);
      // Same redirect-follow behaviour as checkout. Lands the user on
      // Polar's customer portal where they can update payment methods,
      // change plans, or cancel.
      await authClient.customer.portal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't open billing portal.",
      );
      setPortalPending(false);
    }
  };

  if (subscriptionQuery.isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Loading your plan…</CardDescription>
        </CardHeader>
        <CardContent className="flex h-24 items-center justify-center">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Subscription</CardTitle>
            <CardDescription>{headline}</CardDescription>
          </div>
          {data.paidPlan ? (
            <Badge variant="outline" className="gap-1">
              <SparklesIcon className="size-3" />
              {data.paidPlan === "SCHOLAR" ? "Scholar" : "Explorer"}
              {currentInterval ? ` · ${intervalLabel(currentInterval)}` : ""}
            </Badge>
          ) : data.isAlpha ? (
            <Badge variant="secondary">Open Alpha</Badge>
          ) : (
            <Badge variant="outline">Free</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Founding-tier titles available {FOUNDING_CUTOFF_LABEL}.
          </p>
          <ToggleGroup
            type="single"
            value={interval}
            onValueChange={(value) => {
              if (value === "MONTH" || value === "YEAR") setInterval(value);
            }}
            className="rounded-md border border-border bg-muted/30 p-0.5"
          >
            <ToggleGroupItem
              value="MONTH"
              className="px-4 py-1.5 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground"
            >
              Monthly
            </ToggleGroupItem>
            <ToggleGroupItem
              value="YEAR"
              className="px-4 py-1.5 text-xs data-[state=on]:bg-background data-[state=on]:text-foreground"
            >
              Yearly
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.catalogue.map((plan) => {
            const product = plan.pricing[interval];
            const isCurrent = data.paidPlan === plan.key;
            const savings = savingsCopy(
              interval,
              plan.pricing.MONTH.priceUsd,
              plan.pricing.YEAR.priceUsd,
            );
            return (
              <div
                key={plan.key}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-heading text-lg font-semibold">
                      {plan.label}
                    </h3>
                    <p className="text-right text-sm">
                      <span className="text-2xl font-semibold">
                        ${product.priceUsd}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {intervalSuffix(interval)}
                      </span>
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                  {savings ? (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {savings}
                    </p>
                  ) : null}
                </div>

                <ul className="flex flex-col gap-1.5 text-sm">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-foreground/90"
                    >
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <p className="font-medium uppercase tracking-wide text-muted-foreground/80">
                    Best for
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {plan.bestFor.map((label) => (
                      <li key={label}>
                        <Badge
                          variant="outline"
                          className="rounded-md border-dashed text-[11px] font-normal"
                        >
                          {label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  {isCurrent ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={handlePortal}
                      disabled={portalPending}
                    >
                      {portalPending ? (
                        <Spinner />
                      ) : (
                        <>
                          Manage in Polar
                          <ExternalLinkIcon className="ml-1 size-3.5" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="cursor-pointer"
                      onClick={() => handleCheckout(product.slug)}
                      disabled={pendingSlug !== null}
                    >
                      {pendingSlug === product.slug ? (
                        <Spinner />
                      ) : data.paidPlan ? (
                        `Switch to ${plan.label}`
                      ) : (
                        `Upgrade to ${plan.label}`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {data.paidPlan ? (
          <div className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Need to cancel or update payment?
            </span>
            <span>
              Use <strong>Manage in Polar</strong> above to open the secure
              billing portal — Polar handles the rest.
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
