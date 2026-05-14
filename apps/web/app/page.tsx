import Image from "next/image";
import Link from "next/link";
import {
  BookOpenTextIcon,
  CalendarDaysIcon,
  FlameIcon,
  GraduationCapIcon,
  NotebookPenIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { CyclingTagline } from "@/components/hero/cycling-tagline";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL || "http://localhost:3001";

const HERO_TAGLINES = [
  "curious people.",
  "lifelong learners.",
  "those who love to learn.",
  "AuDHD rabbit holers.",
  "autodidacts.",
  "neurospicy researchers.",
  "science enthusiasts.",
  "polymaths of all trades.",
  "prospective MENSA members.",
  "tinkering tinkerers.",
  "DIY enthusiasts.",
  "bored Uni students.",
  "innovative game devs.",
  "3AM insomniacs.",
  "PhD barristas.",
  "startup founders.",
  "big cat lovers.",
  "small dog owners.",
  "plant parents.",
  "music lovers.",
  "French movie buffs.",
  "bookworms.",
  "podcast addicts.",
  "occult enthusiasts.",
  "cryptozoologists.",
  "conlang inventors.",
  "medieval history buffs.",
  "Harlem Rennaissance historians.",
  "stage magicians.",
  "you.",
  "neurodiverse learners.",
  "retro futurists.",
  "wizards on a journey.",
  "witches in training.",
] as const;

const features = [
  {
    icon: SparklesIcon,
    title: "Curricula tailored to your goal",
    body:
      "Tell Quazom a subject, level, and what success looks like. We compose a structured course—modules, lessons, projects, and quizzes—shaped around the way you want to learn.",
  },
  {
    icon: BookOpenTextIcon,
    title: "Lessons that meet you where you are",
    body:
      "Readings, videos, exercises, and projects sit side-by-side. Each lesson is generated on demand, so the depth and pacing match the curriculum—not a one-size-fits-all template.",
  },
  {
    icon: CalendarDaysIcon,
    title: "A study schedule that fits real life",
    body:
      "Pick the days and hours that work for you. Quazom lays out a calendar with bite-sized sessions so the next thing to study is always one click away.",
  },
  {
    icon: FlameIcon,
    title: "Streaks and check-ins that stick",
    body:
      "A single button to mark today done. Watch the streak grow, see your progress on the calendar, and let the gentle pressure keep you coming back.",
  },
  {
    icon: NotebookPenIcon,
    title: "Notes that travel with you",
    body:
      "Capture an idea on the dashboard, drop a thought into a lesson—Quazom keeps your notes alongside the material so they're there when you return.",
  },
  {
    icon: GraduationCapIcon,
    title: "Quizzes and discussions, built in",
    body:
      "Test what you've learned with auto-generated quizzes, or talk a topic through with the AI tutor. Every interaction is grounded in the curriculum you're building.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <FirstShowcaseSection />
        <FeaturesSection />
        <SecondShowcaseSection />
        <ClosingCtaSection />
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
  const demoVideoUrl = "https://youtu.be/7Pf4W9E-NKc";
  // Pick the first tagline on the server so the SSR HTML and the first client
  // render agree; the CyclingTagline component takes over and rotates from there.
  const initialTaglineIndex = Math.floor(Math.random() * HERO_TAGLINES.length);

  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-linear-to-b from-muted/40 via-background to-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-6 pt-16 pb-12 text-center sm:pt-20 md:pt-28 md:pb-20">
        <div className="flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground shadow-xs">
            <SparklesIcon className="size-3.5 text-primary" />
            Closed alpha — join the waitlist
          </span>
          <h1 className="font-heading text-4xl leading-[1.05] font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Personal curricula,
            <br className="hidden sm:block" />
            <span className="italic text-primary">
              {" "}
              built around
              <br className="hidden sm:block" />
              <CyclingTagline
                taglines={HERO_TAGLINES}
                initialIndex={initialTaglineIndex}
                intervalMs={3000}
              />
            </span>
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            Tell Quazom what you want to learn. We&rsquo;ll handcraft the
            modules, lessons, exercises, and quizzes—then keep you on track with
            a daily schedule, streaks, and notes that travel with you.
          </p>
          <h2 className="font-heading text-2xl leading-tight tracking-tight text-foreground sm:text-3xl"> Watch the Demo: <a href={demoVideoUrl} target="_blank" className="underline underline-offset-2 hover:text-primary">Quazom in action</a></h2>
          <div className="mt-4 w-full max-w-xl">
            <WaitlistForm source="homepage" cta="Get my invite" />
          </div>
          <p className="text-xs text-muted-foreground">
            Free during alpha · No credit card required ·{" "}
            <a
              href={`${MAIN_URL}/login`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Already have an account?
            </a>
          </p>
        </div>
        <ScreenshotFrame
          src="/img/screenshot-1.png"
          alt="The Quazom dashboard, showing today's study schedule and a recent note."
          priority
        />
      </div>
    </section>
  );
}

function FirstShowcaseSection() {
  return (
    <section className="border-b border-border/60 bg-card/50">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-2 md:gap-16 md:py-24 md:items-center">
        <div className="flex flex-col gap-5">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Curriculum, generated
          </span>
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            A complete course, drafted while you finish your coffee.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pick a subject, set the level, sketch the goal. Quazom returns a
            structured curriculum—modules with clear arcs, a mix of readings,
            videos, exercises, and projects, and quizzes between them so you
            actually know it landed.
          </p>
          <ul className="flex flex-col gap-3 text-sm text-foreground/90 sm:text-base">
            <ShowcaseBullet>
              Every lesson sized to a single sitting, with explicit prerequisites.
            </ShowcaseBullet>
            <ShowcaseBullet>
              Generate any lesson on demand—keep the curriculum slim until you need depth.
            </ShowcaseBullet>
            <ShowcaseBullet>
              Edit, regenerate, or replace any module to make the course truly yours.
            </ShowcaseBullet>
          </ul>
        </div>
        <ScreenshotFrame
          src="/img/screenshot-3.png"
          alt="A Quazom module dialog listing the lessons in a Physics curriculum."
        />
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Everything in one place
          </span>
          <h2 className="font-heading max-w-3xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            A study companion that does the planning—so you can focus on the learning.
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Quazom holds the whole study loop together: the syllabus, the
            schedule, the lesson you&rsquo;re sitting down to, and the note you
            just wrote about it.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SecondShowcaseSection() {
  return (
    <section className="border-b border-border/60 bg-card/50">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 md:grid-cols-2 md:gap-16 md:py-24 md:items-center">
        <ScreenshotFrame
          src="/img/screenshot-2.png"
          alt="A Quazom lesson on 'What is Physics?' with overview and main content."
          className="md:order-1"
        />
        <div className="flex flex-col gap-5 md:order-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Lessons, not slop
          </span>
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Lessons that read like a book—not a chatbot transcript.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every reading opens with an overview, builds the idea step by step,
            and ends with something to do. Add private notes alongside the
            content, and they show up the next time you open the lesson.
          </p>
          <ul className="flex flex-col gap-3 text-sm text-foreground/90 sm:text-base">
            <ShowcaseBullet>
              Readings, videos, exercises, projects, quizzes—each rendered in a layout built for it.
            </ShowcaseBullet>
            <ShowcaseBullet>
              Discussion mode lets you talk through a topic with an AI tutor that knows your curriculum.
            </ShowcaseBullet>
            <ShowcaseBullet>
              Mark a lesson done in one tap and your streak ticks forward.
            </ShowcaseBullet>
          </ul>
        </div>
      </div>
    </section>
  );
}

function ClosingCtaSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center md:py-28">
        <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Pick something to learn.
          <br />
          <span className="italic text-primary">We&rsquo;ll build the curriculum.</span>
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Quazom is in closed alpha. Drop your name and email and we&rsquo;ll
          send you an invite as soon as a spot opens up.
        </p>
        <div className="mt-2 w-full max-w-xl">
          <WaitlistForm source="homepage" cta="Join the waitlist" />
        </div>
        <p className="text-xs text-muted-foreground">
          Want the full pitch first?{" "}
          <Link
            href="/waitlist"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Read more about the alpha →
          </Link>
        </p>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <span className="font-heading text-base font-semibold tracking-tight text-foreground">
          Quazom
        </span>
        <span>© {new Date().getFullYear()} Quazom. Personal curricula, generated by AI.</span>
      </div>
    </footer>
  );
}

function FeatureCard({
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

function ShowcaseBullet({ children }: { children: React.ReactNode }) {
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

function ScreenshotFrame({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg ring-1 ring-foreground/5 ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-foreground/4 to-transparent"
      />
      <Image
        src={src}
        alt={alt}
        width={3024}
        height={1660}
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 600px"
        priority={priority}
        className="relative h-auto w-full"
      />
    </div>
  );
}
