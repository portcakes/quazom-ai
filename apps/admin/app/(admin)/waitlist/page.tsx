import {
  CalendarClockIcon,
  CheckCircle2Icon,
  ClockIcon,
  HourglassIcon,
  MailIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { SendAlphaInviteButton } from "@/components/send-alpha-invite-button";
import { WaitlistFilterSelector } from "@/components/waitlist-filter-selector";
import {
  getWaitlistOverview,
  getWaitlistRows,
  parseWaitlistFilter,
  type WaitlistRow,
  type WaitlistStatus,
} from "@/lib/queries/waitlist";

type PageProps = {
  searchParams: Promise<{ filter?: string | string[] }>;
};

export default async function WaitlistPage({ searchParams }: PageProps) {
  const { filter: rawFilter } = await searchParams;
  const filter = parseWaitlistFilter(rawFilter);

  // Run the aggregate query and the row query in parallel — they hit
  // different tables and don't share intermediate state, so parallelising
  // them shaves a round-trip off the page TTFB.
  const [overview, rows] = await Promise.all([
    getWaitlistOverview(),
    getWaitlistRows(filter),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Waitlist
        </span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              Alpha invitations.
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Everyone who&rsquo;s signed up for early access — and exactly
              where each one is in the funnel. Send a fresh alpha code with a
              single click; the button greys out once they&rsquo;ve made an
              account.
            </p>
          </div>
        </div>
      </header>

      <section
        aria-label="Waitlist KPIs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      >
        <StatCard
          label="Total signups"
          value={overview.totalSignups}
          icon={MailIcon}
        />
        <StatCard
          label="Awaiting invite"
          value={overview.awaitingInvite}
          hint="Never received a code"
          icon={HourglassIcon}
        />
        <StatCard
          label="Invites sent"
          value={overview.invitesSent}
          icon={SendIcon}
        />
        <StatCard
          label="Invites pending"
          value={overview.invitesAwaitingRedemption}
          hint="Live, unredeemed"
          icon={ClockIcon}
        />
        <StatCard
          label="Redeemed"
          value={overview.invitesRedeemed}
          hint="Accounts created"
          icon={CheckCircle2Icon}
        />
        <StatCard
          label="Expired"
          value={overview.invitesExpired}
          hint="Need a re-send"
          icon={XCircleIcon}
        />
      </section>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Waitlist members
          </h2>
          <WaitlistFilterSelector active={filter} />
        </div>

        <div className="rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-card/60 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <Th className="text-left pl-4">Member</Th>
                  <Th className="text-left">Source</Th>
                  <Th className="text-left">Status</Th>
                  <Th className="text-right">Invites</Th>
                  <Th className="text-right">Last invite</Th>
                  <Th className="text-right">Key expires</Th>
                  <Th className="text-right">Joined</Th>
                  <Th className="text-right pr-4">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No waitlist members match this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <WaitlistTableRow key={row.id} row={row} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaitlistTableRow({ row }: { row: WaitlistRow }) {
  const latest = row.latestInvite;

  // Pick the right button variant from the enriched status. Centralising
  // this here keeps the client component dumb — it just renders whatever
  // we tell it.
  let variant:
    | "send"
    | "resend"
    | "pending"
    | "has-account"
    | "redeemed";
  if (row.hasAccount) {
    variant = "has-account";
  } else if (latest?.redeemedAt) {
    variant = "redeemed";
  } else if (!latest || latest.expired || !latest.sentAt) {
    variant = row.invitesSent === 0 ? "send" : "resend";
  } else {
    variant = "pending";
  }

  return (
    <tr className="hover:bg-muted/40 transition-colors">
      <Td className="text-left pl-4">
        <div className="flex min-w-0 flex-col gap-0.5 py-1">
          <span className="truncate font-medium text-foreground">
            {row.firstName}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {row.email}
          </span>
        </div>
      </Td>
      <Td className="text-left">
        <span className="text-xs text-muted-foreground">
          {row.source ?? "—"}
        </span>
      </Td>
      <Td className="text-left">
        <StatusPill status={row.status} hasAccount={row.hasAccount} />
      </Td>
      <NumTd value={row.invitesSent} />
      <Td className="text-right">
        {latest?.sentAt ? (
          <span
            title={latest.sentAt.toISOString()}
            className="whitespace-nowrap text-xs text-muted-foreground"
          >
            {formatDistanceToNow(latest.sentAt, { addSuffix: true })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </Td>
      <Td className="text-right">
        {latest ? (
          <span
            title={latest.expiresAt.toISOString()}
            className={`whitespace-nowrap text-xs ${
              latest.expired && !latest.redeemedAt && !row.hasAccount
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            <CalendarClockIcon className="mr-1 inline-block size-3 align-[-1px]" />
            {format(latest.expiresAt, "MMM d, yyyy")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </Td>
      <Td className="text-right">
        <span
          title={row.joinedAt.toISOString()}
          className="whitespace-nowrap text-xs text-muted-foreground"
        >
          {formatDistanceToNow(row.joinedAt, { addSuffix: true })}
        </span>
      </Td>
      <Td className="text-right pr-4">
        <div className="flex justify-end">
          <SendAlphaInviteButton
            waitlistEntryId={row.id}
            email={row.email}
            variant={variant}
          />
        </div>
      </Td>
    </tr>
  );
}

function StatusPill({
  status,
  hasAccount,
}: {
  status: WaitlistStatus;
  hasAccount: boolean;
}) {
  if (hasAccount) {
    return <Pill tone="success">Account created</Pill>;
  }
  switch (status) {
    case "redeemed":
      return <Pill tone="success">Account created</Pill>;
    case "invited":
      return <Pill tone="primary">Invite live</Pill>;
    case "expired":
      return <Pill tone="warning">Invite expired</Pill>;
    case "joined":
    default:
      return <Pill tone="muted">Awaiting invite</Pill>;
  }
}

function Pill({
  tone,
  children,
}: {
  tone: "primary" | "success" | "warning" | "muted";
  children: React.ReactNode;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    warning:
      "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${toneClass}`}
    >
      {children}
    </span>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-3 font-medium ${className}`}>{children}</th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}

function NumTd({ value }: { value: number }) {
  return (
    <td className="px-3 py-2 text-right align-middle">
      <span className="font-mono text-sm tabular-nums text-foreground">
        {value.toLocaleString()}
      </span>
    </td>
  );
}
