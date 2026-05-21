import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CompassIcon,
  HeartHandshakeIcon,
  MailIcon,
  ScrollTextIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";
import { PricingTiers } from "@/components/pricing/pricing-tiers";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL || "http://localhost:3001";
const SUPPORT_EMAIL = "hello@quazom.ai";

export const metadata: Metadata = {
  title: "Pricing · Quazom",
  description:
    "Quazom is free during the closed alpha. Founding Explorer and Founding Scholar plans unlock higher generation limits, future research tools, and a permanent founding-tier title beside your name.",
  openGraph: {
    title: "Pricing · Quazom",
    description:
      "Free during alpha. Founding Explorer and Founding Scholar tiers unlock higher generation limits and a permanent founding title beside your name.",
    images: [{ url: "https://www.quazom.ai/og-image.png" }],
  },
};

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <PlansSection />
        <PhilosophySection />
        <ExpeditedAccessSection />
        <FaqSection />
        <BottomCtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:py-5">
        <Link
          href="/"
          className="font-heading text-2xl font-bold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          Quazom
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeftIcon className="size-3.5" />
              Back home
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={`${MAIN_URL}/login`}>Sign in</a>
          </Button>
          <Button asChild size="sm" className="font-medium">
            <Link href="/waitlist">Join waitlist</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-linear-to-b from-muted/40 via-background to-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 pt-16 pb-12 text-center sm:pt-20 md:pt-28 md:pb-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground shadow-xs">
          <SparklesIcon className="size-3.5 text-primary" />
          Pricing · transparent and intentionally accessible
        </span>
        <h1 className="font-heading text-4xl leading-[1.05] font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Learning shouldn&rsquo;t feel
          <br className="hidden sm:block" />
          <span className="italic text-primary"> financially out of reach.</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
          Quazom is free during the closed alpha. When you&rsquo;re ready for
          higher generation limits and a permanent founding-tier title beside
          your name, choose the plan that matches the way you want to learn.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-card px-3 py-1">
            Free during alpha
          </span>
          <span className="rounded-full border border-border/70 bg-card px-3 py-1">
            Founding tiers · until July 7, 2026
          </span>
          <span className="rounded-full border border-border/70 bg-card px-3 py-1">
            Cancel any time
          </span>
        </div>
      </div>
    </section>
  );
}

function PlansSection() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Three ways to learn
          </span>
          <h2 className="font-heading max-w-3xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Start free. Upgrade when you outgrow the alpha caps.
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Founding Explorer and Founding Scholar are limited-time tiers. Pick
            one before July 7, 2026 to permanently lock in the matching
            scholarly title displayed beside your name in the sidebar.
          </p>
        </div>
        <div className="mt-12 md:mt-16">
          <PricingTiers />
        </div>
      </div>
    </section>
  );
}

function PhilosophySection() {
  return (
    <section className="border-b border-border/60 bg-card/50">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1fr_1.4fr] md:gap-16 md:py-24 md:items-start">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Our pricing ethos
          </span>
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Sustainable, not extractive.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Quazom exists to help people explore, study, research, and grow—not
            to gate curiosity behind unnecessary complexity or pricing barriers.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <PrincipleCard
            icon={HeartHandshakeIcon}
            title="Affordable access"
            body="Traditional education can be prohibitively expensive. Quazom is intentionally priced to keep structured learning within reach."
          />
          <PrincipleCard
            icon={ScrollTextIcon}
            title="Transparent pricing"
            body="No surprise tiers, no usage walls hidden in fine print. What you read here is what you get—and what you pay."
          />
          <PrincipleCard
            icon={CompassIcon}
            title="Flexible learning"
            body="Pause, cancel, switch tiers, or come back later. Your curricula, notes, and progression stay yours."
          />
          <PrincipleCard
            icon={SparklesIcon}
            title="Long-term growth"
            body="The roadmap is built around continuity—knowledge graphs, research mode, and adaptive curricula are coming for the people who stay."
          />
        </div>
      </div>
    </section>
  );
}

function ExpeditedAccessSection() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 md:py-20">
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-md ring-1 ring-foreground/5 sm:p-10">
          <div className="flex flex-col gap-4 text-center">
            <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium tracking-wide text-primary">
              <SparklesIcon className="size-3.5" />
              Skip the line
            </span>
            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              Want in faster?
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              We expedite invites for people who tell us what they want to
              learn. Already on the waitlist? <strong>Reply to your
              waitlist confirmation email</strong> with a short note about your
              first curriculum. Not on the list yet? Send us a quick email at{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                {SUPPORT_EMAIL}
              </a>{" "}
              and we&rsquo;ll bump you up.
            </p>
            <div className="mt-2 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="font-medium">
                <a href={`mailto:${SUPPORT_EMAIL}?subject=Expedited%20Quazom%20access`}>
                  <MailIcon className="size-4" />
                  Email {SUPPORT_EMAIL}
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-medium">
                <Link href="/waitlist">
                  Join the waitlist
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="border-b border-border/60 bg-card/50">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1fr_1.4fr] md:gap-16 md:py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            A few common questions
          </span>
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            What you should know about pricing.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Got something we didn&rsquo;t cover?{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            — a real human will answer.
          </p>
        </div>
        <dl className="flex flex-col divide-y divide-border/60">
          <FaqItem question="Do I have to pay during the alpha?">
            No. The Alpha tier is free. We won&rsquo;t ask for a card to sign
            up, and the alpha caps (5 curricula total, 30 lessons per month, 10
            discussions per month) reset automatically on the first of each
            month.
          </FaqItem>
          <FaqItem question="What is a &ldquo;Founding&rdquo; tier?">
            Founding Explorer and Founding Scholar are the same Explorer and
            Scholar plans, available now during a limited window (through July
            7, 2026 at midnight Eastern Time). Subscribing during this window
            permanently unlocks the matching scholarly title—&ldquo;Founding
            Explorer&rdquo; or &ldquo;Founding Scholar&rdquo;—displayed beside
            your name inside the app.
          </FaqItem>
          <FaqItem question="What happens to my title if I cancel?">
            Founding-tier titles stay in your account forever once earned. If
            you upgrade and downgrade across both tiers during the founding
            window, you&rsquo;ll collect both titles and can pick which one to
            display in your settings.
          </FaqItem>
          <FaqItem question="What counts toward my limits?">
            Generations count, not reads. Creating a new curriculum or
            generating a new lesson costs a slot; opening a curriculum or
            re-reading a lesson is always free. Discussion lessons count toward
            both the lesson cap and a separate discussion cap.
          </FaqItem>
          <FaqItem question="Can I switch tiers later?">
            Yes—upgrade or downgrade any time from the in-app billing portal.
            Your curricula, notes, schedules, and progression are all yours and
            don&rsquo;t move when your plan does.
          </FaqItem>
          <FaqItem question="When does pricing actually apply?">
            Today the Alpha tier is the only active plan—new users join the
            waitlist, get an invite, and use Quazom for free. The Founding
            Explorer and Founding Scholar tiers become available the moment
            paid subscriptions open up; everyone on the waitlist gets the
            heads-up first.
          </FaqItem>
        </dl>
      </div>
    </section>
  );
}

function BottomCtaSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center md:py-28">
        <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Pick something to learn.
          <br />
          <span className="italic text-primary">
            We&rsquo;ll build the curriculum.
          </span>
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Drop your name and email and we&rsquo;ll save you a seat in the alpha.
          Reply to the confirmation email—or send us a note at{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          —to skip the line.
        </p>
        <div className="mt-2 w-full max-w-xl">
          <WaitlistForm
            source="pricing-page"
            cta="Join the waitlist"
            successTitle="You're on the list."
            successBody="Thanks—reply to the confirmation email with what you want to learn and we'll bump you up the queue."
          />
        </div>
      </div>
    </section>
  );
}

function PrincipleCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-xl border border-border/70 bg-background p-5 shadow-xs">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
        <Icon className="size-4.5" />
      </span>
      <h3 className="font-heading text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 py-5 first:pt-0 last:pb-0">
      <dt className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {question}
      </dt>
      <dd className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {children}
      </dd>
    </div>
  );
}
