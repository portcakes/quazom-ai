"use client";

import { useState } from "react";
import {
  CheckIcon,
  CompassIcon,
  LeafIcon,
  MoonStarIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { cn } from "@quazom-ai/ui/lib/utils";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL || "http://localhost:3001";

type Interval = "monthly" | "yearly";

type PriceLine = {
  monthly: { amount: string; suffix: string };
  yearly: { amount: string; suffix: string; savings?: string };
};

type Tier = {
  badge: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  /** `null` for the alpha free tier so we render "Free" instead of a price. */
  price: PriceLine | null;
  freeLabel?: string;
  limitsLabel: string;
  features: ReadonlyArray<string>;
  bestFor: ReadonlyArray<string>;
  cta: { label: string; href: string; variant?: "default" | "outline" };
  /** Subtle visual emphasis on the recommended/centerpiece card. */
  highlight?: boolean;
  /** Optional ribbon e.g. "Founding window" badge. */
  ribbon?: string;
};

const TIERS: ReadonlyArray<Tier> = [
  {
    badge: "Free · open alpha",
    name: "Open Alpha",
    tagline:
      "The whole core platform, on the house. Generate curricula, write notes, schedule study, and listen to your work — with sensible monthly caps so we can keep the servers warm.",
    icon: LeafIcon,
    price: null,
    freeLabel: "Free",
    limitsLabel: "Monthly generation limits",
    features: [
      "5 curriculum generations (lifetime cap)",
      "30 lesson generations per month",
      "10 discussion-style lessons per month",
      "10 TTS audio generations per month",
      "Markdown notes, annotations, and resource uploads",
      "Continuity Notes with tags",
      "Study scheduling, check-ins, and streaks",
      "Module graduation across beginner → advanced",
    ],
    bestFor: [
      "Anyone curious to try Quazom",
      "Students supplementing coursework",
      "Hobbyists exploring a new interest",
    ],
    cta: { label: "Start free", href: `${MAIN_URL}/register` },
  },
  {
    badge: "Founding window · until July 7, 2026",
    name: "Founding Explorer",
    tagline:
      "For curious learners exploring new subjects and building study habits, with more room to actually use the thing.",
    icon: CompassIcon,
    price: {
      monthly: { amount: "$5", suffix: "/mo" },
      yearly: { amount: "$100", suffix: "/yr", savings: "Save 4 months" },
    },
    limitsLabel: "Higher monthly limits",
    features: [
      "10 curriculum generations per month",
      "100 lesson generations per month",
      "30 discussion-style lessons per month",
      "50 TTS audio generations per month",
      "Everything in Open Alpha",
      "“Founding Explorer” title beside your name",
    ],
    bestFor: [
      "Casual learners",
      "Hobbyists",
      "Students supplementing coursework",
      "Lifelong learners exploring multiple interests",
    ],
    cta: {
      label: "Get Founding Explorer",
      href: `${MAIN_URL}/register?plan=explorer&checkout=1`,
      variant: "default",
    },
    highlight: true,
    ribbon: "Most popular",
  },
  {
    badge: "Founding window · until July 7, 2026",
    name: "Founding Scholar",
    tagline:
      "For deep learners, researchers, polymaths, and anyone making Quazom part of their long-term intellectual workflow.",
    icon: MoonStarIcon,
    price: {
      monthly: { amount: "$15", suffix: "/mo" },
      yearly: { amount: "$150", suffix: "/yr", savings: "Save 2 months" },
    },
    limitsLabel: "No generation limits",
    features: [
      "Unlimited curriculum generation",
      "Unlimited lesson generation",
      "Unlimited TTS audio generations",
      "Everything in Founding Explorer",
      "Priority access to new features",
      "“Founding Scholar” title beside your name",
    ],
    bestFor: [
      "Independent researchers and writers",
      "Graduate students and creators",
      "Interdisciplinary learners",
      "Heavy Quazom users",
    ],
    cta: {
      label: "Get Founding Scholar",
      href: `${MAIN_URL}/register?plan=scholar&checkout=1`,
      variant: "outline",
    },
  },
];

export function PricingTiers() {
  // The Alpha tier renders the same regardless of toggle, but the toggle
  // still drives which price face is displayed for the two paid tiers, so
  // it lives on the parent and threads through.
  const [interval, setInterval] = useState<Interval>("monthly");

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <div className="flex flex-col items-center gap-3">
        <IntervalToggle value={interval} onChange={setInterval} />
        <p className="text-xs text-muted-foreground">
          Switch to yearly to save the price of a few months.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        {TIERS.map((tier) => (
          <TierCard key={tier.name} tier={tier} interval={interval} />
        ))}
      </div>
    </div>
  );
}

function IntervalToggle({
  value,
  onChange,
}: {
  value: Interval;
  onChange: (next: Interval) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Billing interval"
      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card p-1 shadow-xs"
    >
      <ToggleButton
        active={value === "monthly"}
        onClick={() => onChange("monthly")}
      >
        Monthly
      </ToggleButton>
      <ToggleButton
        active={value === "yearly"}
        onClick={() => onChange("yearly")}
      >
        Yearly
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-xs font-medium tracking-wide transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TierCard({ tier, interval }: { tier: Tier; interval: Interval }) {
  const Icon = tier.icon;
  const price = tier.price?.[interval];
  return (
    <article
      className={cn(
        // Base card matches the FeatureCard treatment from /page.tsx so the
        // tier grid sits next to existing sections without looking foreign.
        "relative flex h-full flex-col gap-5 rounded-2xl border bg-card p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md md:p-8",
        tier.highlight
          ? "border-primary/40 ring-1 ring-primary/20 shadow-md"
          : "border-border/70",
      )}
    >
      {tier.ribbon ? (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-primary/30 bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary shadow-xs">
          <SparklesIcon className="size-3" />
          {tier.ribbon}
        </span>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-lg ring-1",
              tier.highlight
                ? "bg-primary/15 text-primary ring-primary/25"
                : "bg-primary/10 text-primary ring-primary/15",
            )}
          >
            <Icon className="size-5" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {tier.badge}
          </span>
        </div>
        <h3 className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          {tier.name}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tier.tagline}
        </p>
      </div>

      <PriceBlock price={price} freeLabel={tier.freeLabel} />

      <div className="flex flex-col gap-2 border-t border-border/60 pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {tier.limitsLabel}
        </p>
        <ul className="flex flex-col gap-2.5">
          {tier.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90"
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full ring-1",
                  tier.highlight
                    ? "bg-primary/15 text-primary ring-primary/25"
                    : "bg-primary/10 text-primary ring-primary/15",
                )}
              >
                <CheckIcon className="size-3" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Best for
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {tier.bestFor.map((label) => (
            <li
              key={label}
              className="rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-2">
        <Button
          asChild
          size="lg"
          variant={tier.highlight ? "default" : tier.cta.variant ?? "default"}
          className="w-full"
        >
          <a href={tier.cta.href}>{tier.cta.label}</a>
        </Button>
      </div>
    </article>
  );
}

function PriceBlock({
  price,
  freeLabel,
}: {
  price: PriceLine[Interval] | undefined;
  freeLabel?: string;
}) {
  if (!price) {
    // Open Alpha tier — render a "Free" stamp where the price would
    // normally sit so all three cards keep their vertical rhythm aligned.
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {freeLabel ?? "Free"}
          </span>
          <span className="text-sm text-muted-foreground">forever</span>
        </div>
        <p className="text-xs text-muted-foreground">
          No credit card required.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {price.amount}
        </span>
        <span className="text-sm text-muted-foreground">{price.suffix}</span>
      </div>
      {"savings" in price && price.savings ? (
        <p className="text-xs font-medium text-primary">{price.savings}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Cancel any time from the customer portal.
        </p>
      )}
    </div>
  );
}
