import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  CalendarDaysIcon,
  CoinsIcon,
  FileTextIcon,
  HighlighterIcon,
  LogInIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StickyNoteIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { RangeSelector } from "@/components/range-selector";
import { parseRangeId, rangeLabel } from "@/lib/range";
import { getUserDetail } from "@/lib/queries/analytics";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
};

const KIND_LABELS: Record<string, string> = {
  CURRICULUM: "Curriculum generation",
  CURRICULUM_BACKFILL: "Curriculum backfill",
  LESSON: "Lesson generation",
  DISCUSSION_REPLY: "Discussion replies",
  SUBMISSION_FEEDBACK: "Quiz / exercise feedback",
  NOTE_SUMMARY: "Note summarizations",
};

export default async function UserDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, { range: rawRange }] = await Promise.all([params, searchParams]);
  const rangeId = parseRangeId(rawRange);

  const detail = await getUserDetail(id, rangeId);
  if (!detail) notFound();

  const { user, stats, tokensByKind, recentSignIns } = detail;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={`/users?range=${rangeId}`}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          Back to users
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              User detail
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                {user.name || user.email}
              </h1>
              {user.isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary">
                  <ShieldCheckIcon className="size-3" />
                  Admin
                </span>
              ) : null}
              {user.isDisabled ? (
                <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-destructive">
                  Disabled
                </span>
              ) : null}
              {!user.isOnboarded ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Onboarding
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{user.email}</span>
              {user.referralSource ? (
                <> · referred by <span className="font-medium text-foreground">{user.referralSource}</span></>
              ) : null}
              {" · "}
              joined {format(user.createdAt, "MMM d, yyyy")}
            </p>
          </div>
          <RangeSelector active={rangeId} />
        </div>
      </header>

      <section
        aria-label="Sign-in activity"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Sign-ins"
          value={stats.signInsInRange}
          hint={`${stats.signInsAllTime.toLocaleString()} all-time`}
          icon={LogInIcon}
        />
        <StatCard
          label="Last seen"
          value={
            stats.lastSignInAt
              ? formatDistanceToNow(stats.lastSignInAt, { addSuffix: true })
              : "Never"
          }
          hint={
            stats.lastSignInAt
              ? format(stats.lastSignInAt, "PPpp")
              : "No sessions yet"
          }
        />
        <StatCard
          label="AI tokens used"
          value={stats.tokensInRange}
          hint={`${stats.tokensAllTime.toLocaleString()} all-time`}
          icon={CoinsIcon}
        />
        <StatCard
          label="Curricula generated"
          value={stats.curriculaInRange}
          hint={`${stats.curriculaAllTime.toLocaleString()} all-time`}
          icon={SparklesIcon}
        />
      </section>

      <section
        aria-label="Activity in range"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatCard
          label="Lessons generated"
          value={stats.lessonsInRange}
          hint={`${stats.lessonsAllTime.toLocaleString()} all-time`}
          icon={BookOpenTextIcon}
        />
        <StatCard
          label="Schedules created"
          value={stats.schedulesInRange}
          hint={`${stats.schedulesAllTime.toLocaleString()} all-time`}
          icon={CalendarDaysIcon}
        />
        <StatCard
          label="Notes created"
          value={stats.notesInRange}
          hint={`${stats.notesAllTime.toLocaleString()} all-time · excludes auto-annotation notes`}
          icon={StickyNoteIcon}
        />
        <StatCard
          label="Annotations"
          value={stats.annotationsInRange}
          hint={`${stats.annotationsAllTime.toLocaleString()} all-time`}
          icon={HighlighterIcon}
        />
        <StatCard
          label="Note summarizations"
          value={stats.noteSummariesInRange}
          hint="AI summarize-note calls"
          icon={FileTextIcon}
        />
      </section>

      <section
        aria-label="Token usage breakdown and recent sessions"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <TokensByKindCard
          rows={tokensByKind}
          rangeLabel={rangeLabel(rangeId)}
        />
        <RecentSignInsCard rows={recentSignIns} />
      </section>
    </div>
  );
}

function TokensByKindCard({
  rows,
  rangeLabel,
}: {
  rows: Array<{ kind: string; totalTokens: number; callCount: number }>;
  rangeLabel: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.totalTokens, 0);

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Tokens by AI feature
        </h2>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <CoinsIcon className="size-4" />
        </span>
      </header>
      <p className="text-xs text-muted-foreground">
        Token usage breakdown across {rangeLabel.toLowerCase()}.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 bg-background p-4 text-sm text-muted-foreground">
          No AI calls in this range.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {rows.map((row) => {
            const pct = total === 0 ? 0 : Math.round((row.totalTokens / total) * 100);
            return (
              <li
                key={row.kind}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {KIND_LABELS[row.kind] ?? row.kind}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {row.totalTokens.toLocaleString()} · {row.callCount} call{row.callCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div
                  aria-hidden
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function RecentSignInsCard({
  rows,
}: {
  rows: Array<{
    id: string;
    createdAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Recent sessions
        </h2>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <LogInIcon className="size-4" />
        </span>
      </header>
      <p className="text-xs text-muted-foreground">
        Last 10 sign-ins. Better Auth records one row per session, so this
        doubles as a login-frequency log.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/70 bg-background p-4 text-sm text-muted-foreground">
          No sessions yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-foreground">
                  {format(row.createdAt, "MMM d, yyyy 'at' p")}
                </span>
                <span
                  className="truncate text-xs text-muted-foreground"
                  title={row.userAgent ?? undefined}
                >
                  {row.ipAddress ?? "unknown IP"}
                  {row.userAgent ? ` · ${shortenUserAgent(row.userAgent)}` : ""}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(row.createdAt, { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function shortenUserAgent(ua: string): string {
  // The full UA is rarely useful at a glance; we keep just the browser
  // family + OS that comes after the parens, when present.
  const match = ua.match(/\(([^)]+)\)\s+([^\s]+\/[\d.]+)/);
  if (match) return `${match[2]} (${match[1].split(";")[0]?.trim() ?? match[1]})`;
  return ua.length > 80 ? `${ua.slice(0, 77)}…` : ua;
}
