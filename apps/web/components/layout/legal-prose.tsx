import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";

export function LegalSiteHeader() {
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
          <Button asChild size="sm" className="font-medium">
            <Link href="/waitlist">Join waitlist</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

type LegalHeroProps = {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  intro: React.ReactNode;
};

export function LegalHero({
  title,
  effectiveDate,
  lastUpdated,
  intro,
}: LegalHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-linear-to-b from-muted/40 via-background to-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-16 pb-12 sm:pt-20 md:pt-24 md:pb-16">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground shadow-xs">
          Legal · last updated {lastUpdated}
        </span>
        <h1 className="font-heading text-4xl leading-[1.1] font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          {title}
        </h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <div className="flex items-center gap-2">
            <dt>Effective</dt>
            <dd className="text-foreground/80 normal-case tracking-normal font-normal">
              {effectiveDate}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt>Updated</dt>
            <dd className="text-foreground/80 normal-case tracking-normal font-normal">
              {lastUpdated}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {intro}
        </div>
      </div>
    </section>
  );
}

type LegalSectionProps = {
  id?: string;
  title: string;
  children: React.ReactNode;
};

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-b border-border/40 py-10 first:pt-0 last:border-b-0 md:py-12"
    >
      <h2 className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5 flex flex-col gap-4 text-base leading-relaxed text-foreground/85 sm:text-[17px]">
        {children}
      </div>
    </section>
  );
}

export function LegalSubsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col gap-2 pl-1">
      {children}
    </ul>
  );
}

export function LegalLi({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 leading-relaxed">
      <span
        aria-hidden
        className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-primary"
      />
      <span>{children}</span>
    </li>
  );
}

export function LegalEmail({ address }: { address: string }) {
  return (
    <a
      href={`mailto:${address}`}
      className="font-mono text-sm font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary sm:text-base"
    >
      {address}
    </a>
  );
}

export function LegalBody({ children }: { children: React.ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-8 md:py-12">
      {children}
    </article>
  );
}
