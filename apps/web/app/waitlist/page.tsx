import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CompassIcon,
  FlameIcon,
  LayersIcon,
  MailCheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { SiteFooter } from "@/components/layout/site-footer";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL || "http://localhost:3001";

export const metadata: Metadata = {
  title: "Join the waitlist · Quazom",
  description:
    "Quazom is in closed alpha. Sign up with your name and email and we'll send you an invite when a seat opens up.",
};

const reasons = [
  {
    icon: WandSparklesIcon,
    title: "Curricula built around your goal",
    body:
      "Tell Quazom a subject and what success looks like. We draft a complete course—modules, lessons, exercises, projects, and quizzes—shaped to the way you want to learn.",
  },
  {
    icon: LayersIcon,
    title: "Lessons in every format you need",
    body:
      "Readings, videos, exercises, projects, and discussions live side-by-side. Each lesson is generated on demand, so the depth and pacing fit your curriculum—not a template.",
  },
  {
    icon: CalendarDaysIcon,
    title: "A schedule that respects real life",
    body:
      "Pick the days and hours you can actually study. Quazom lays out a calendar of bite-sized sessions so you always know what to open next.",
  },
  {
    icon: FlameIcon,
    title: "Streaks that quietly compound",
    body:
      "One tap to mark today done. Watch the streak grow on the calendar and let the gentle pressure keep you coming back.",
  },
];

const whatHappensNext = [
  {
    icon: MailCheckIcon,
    title: "We confirm your spot",
    body:
      "You&rsquo;ll get a confirmation email right away letting you know we have you on the list.",
  },
  {
    icon: UsersIcon,
    title: "We send invites in waves",
    body:
      "Quazom is in closed alpha while we tune the experience. We open new seats every few weeks and email invites in order.",
  },
  {
    icon: SparklesIcon,
    title: "Your invite arrives",
    body:
      "When it&rsquo;s your turn, we&rsquo;ll send a link with everything you need to get your first curriculum running in minutes.",
  },
];

export default function WaitlistPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <WhyJoinSection />
        <NextStepsSection />
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
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={`${MAIN_URL}/login`}>Sign in</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-linear-to-b from-muted/40 via-background to-background">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-16 pb-16 md:grid-cols-[1.05fr_1fr] md:gap-16 md:pt-24 md:pb-24">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground shadow-xs">
            <SparklesIcon className="size-3.5 text-primary" />
            Closed alpha · Invites by wave
          </span>
          <h1 className="font-heading text-4xl leading-[1.05] font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Get an early seat in the
            <span className="italic text-primary"> Quazom alpha.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Quazom turns any subject into a structured course—modules, lessons,
            quizzes, projects—and lays it out across a study schedule that fits
            your week. Drop your name and email and we&rsquo;ll send you an
            invite as soon as a seat opens up.
          </p>
          <ul className="flex flex-col gap-2.5 text-sm text-foreground/90 sm:text-base">
            <HeroBullet>Free during the alpha. No credit card required.</HeroBullet>
            <HeroBullet>
              Direct line to the team—your feedback shapes the product.
            </HeroBullet>
            <HeroBullet>
              Skip the line by referring a friend once you&rsquo;re in.
            </HeroBullet>
          </ul>
        </div>
        <div className="md:pt-2">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-lg ring-1 ring-foreground/5 sm:p-8">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Reserve your spot
              </p>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Join the waitlist
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                We&rsquo;ll only use your email to send your invite and the
                occasional Quazom update. You can unsubscribe any time.
              </p>
            </div>
            <div className="mt-6">
              <WaitlistForm
                source="waitlist-page"
                variant="stacked"
                cta="Reserve my spot"
                successTitle="You're on the list."
                successBody="We'll email you the moment a seat opens up. While you wait, follow along—and feel free to share Quazom with a friend."
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 text-primary" />
            <span>
              We never sell your email. Read about our{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2 hover:text-foreground"
              >
                approach to your data
              </Link>
              .
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyJoinSection() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Why join the alpha
          </span>
          <h2 className="font-heading max-w-3xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            One place for the syllabus, the schedule, and the lesson you&rsquo;re
            about to study.
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Quazom holds the whole study loop together. No more juggling tabs,
            spreadsheets, and half-finished notes—just open Quazom and the next
            thing to learn is already waiting.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:mt-16 md:grid-cols-2">
          {reasons.map((reason) => (
            <ReasonCard key={reason.title} {...reason} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NextStepsSection() {
  return (
    <section className="border-b border-border/60 bg-card/50">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            What happens next
          </span>
          <h2 className="font-heading max-w-3xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Here&rsquo;s how the waitlist works.
          </h2>
        </div>
        <ol className="mt-12 grid gap-5 md:mt-16 md:grid-cols-3">
          {whatHappensNext.map((step, index) => (
            <NextStepCard key={step.title} step={index + 1} {...step} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1fr_1.4fr] md:gap-16 md:py-24">
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Quick questions
          </span>
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            A few things people usually ask.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Got a different question?{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="mailto:hello@quazom.ai"
            >
              hello@quazom.ai
            </a>{" "}
            — a real human will reply.
          </p>
        </div>
        <dl className="flex flex-col divide-y divide-border/60">
          <FaqItem question="When will I get my invite?">
            We open new seats every few weeks. Most people on the list today
            should expect their invite within the next month or two—earlier if
            we have capacity.
          </FaqItem>
          <FaqItem question="Do I need to pay during the alpha?">
            No. The alpha is free while we&rsquo;re tuning the product. We
            won&rsquo;t ask you for a card during sign-up.
          </FaqItem>
          <FaqItem question="What can Quazom teach me?">
            Anything text-and-video can teach—languages, math, software, design,
            history, exam prep, and more. Quazom builds the curriculum from
            scratch around the topic and goal you give it.
          </FaqItem>
          <FaqItem question="What do you do with my email?">
            We use it to send your invite and occasional product updates.
            That&rsquo;s it—no selling, no third-party lists, and you can
            unsubscribe with one click.
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
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground shadow-xs">
          <CompassIcon className="size-3.5 text-primary" />
          Ready when you are
        </span>
        <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
          One short form.
          <br />
          <span className="italic text-primary">A whole curriculum waiting.</span>
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Drop your name and email and we&rsquo;ll save you a seat. Your future
          self will be very pleased.
        </p>
        <div className="w-full max-w-xl">
          <WaitlistForm
            source="waitlist-page"
            cta="Reserve my spot"
            successTitle="You're on the list."
            successBody="Thanks—we'll email you when your invite is ready."
          />
        </div>
      </div>
    </section>
  );
}

function HeroBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 leading-relaxed">
      <span
        aria-hidden
        className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-primary"
      />
      <span>{children}</span>
    </li>
  );
}

function ReasonCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <article className="group flex h-full flex-col gap-4 rounded-xl border border-border/70 bg-card p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
        <Icon className="size-5" />
      </span>
      <h3 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function NextStepCard({
  step,
  icon: Icon,
  title,
  body,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <li className="relative flex h-full flex-col gap-3 rounded-xl border border-border/70 bg-background p-6 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-4.5" />
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Step {step}
        </span>
      </div>
      <h3 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
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
