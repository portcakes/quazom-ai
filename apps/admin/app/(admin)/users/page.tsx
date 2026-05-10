import Link from "next/link";
import { ChevronRightIcon, ShieldCheckIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RangeSelector } from "@/components/range-selector";
import { parseRangeId, rangeLabel } from "@/lib/range";
import {
  getUserActivity,
  type UserActivityRow,
} from "@/lib/queries/analytics";

type PageProps = {
  searchParams: Promise<{ range?: string | string[] }>;
};

export default async function UsersListPage({ searchParams }: PageProps) {
  const { range: rawRange } = await searchParams;
  const rangeId = parseRangeId(rawRange);

  const rows = await getUserActivity(rangeId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Users
        </span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              Every account, with the receipts.
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Per-user activity, scoped to{" "}
              <span className="font-medium text-foreground">
                {rangeLabel(rangeId).toLowerCase()}
              </span>
              . Click a row to drill in.
            </p>
          </div>
          <RangeSelector active={rangeId} />
        </div>
      </header>

      <div className="rounded-xl border border-border/70 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-card/60 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <Th className="text-left">User</Th>
                <Th className="text-right">Signed in</Th>
                <Th className="text-right">Curricula</Th>
                <Th className="text-right">Lessons</Th>
                <Th className="text-right">Notes</Th>
                <Th className="text-right">Annot.</Th>
                <Th className="text-right">Sched.</Th>
                <Th className="text-right">Summaries</Th>
                <Th className="text-right">Tokens</Th>
                <Th className="text-right">Joined</Th>
                <Th className="text-right pr-4"></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <UserRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserRow({ row }: { row: UserActivityRow }) {
  return (
    <tr className="group hover:bg-muted/40 transition-colors">
      <Td className="text-left pl-4">
        <Link
          href={`/users/${row.id}`}
          className="flex min-w-0 flex-col gap-0.5 py-1"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate font-medium text-foreground group-hover:text-primary">
              {row.name || row.email}
            </span>
            {row.isAdmin ? (
              <span
                title="Admin"
                className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
              >
                <ShieldCheckIcon className="size-3" />
                admin
              </span>
            ) : null}
            {row.isDisabled ? (
              <span
                title="Account disabled"
                className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive"
              >
                disabled
              </span>
            ) : null}
            {!row.isOnboarded ? (
              <span
                title="Hasn't finished onboarding"
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                onboarding
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {row.email}
            {row.referralSource ? ` · via ${row.referralSource}` : ""}
          </span>
        </Link>
      </Td>
      <NumTd value={row.signInsInRange} subValue={`${row.signInsAllTime.toLocaleString()} all-time`} />
      <NumTd value={row.curriculaInRange} />
      <NumTd value={row.lessonsInRange} />
      <NumTd value={row.notesInRange} />
      <NumTd value={row.annotationsInRange} />
      <NumTd value={row.schedulesInRange} />
      <NumTd value={row.noteSummariesInRange} />
      <NumTd value={row.tokensInRange} />
      <Td className="text-right">
        <span
          title={row.createdAt.toISOString()}
          className="whitespace-nowrap text-xs text-muted-foreground"
        >
          {formatDistanceToNow(row.createdAt, { addSuffix: true })}
        </span>
      </Td>
      <Td className="text-right pr-4">
        <Link
          href={`/users/${row.id}`}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          aria-label="View user detail"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </Td>
    </tr>
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

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}

function NumTd({ value, subValue }: { value: number; subValue?: string }) {
  return (
    <td className="px-3 py-2 text-right align-middle">
      <span className="font-mono text-sm tabular-nums text-foreground">
        {value.toLocaleString()}
      </span>
      {subValue ? (
        <div className="text-[11px] text-muted-foreground">{subValue}</div>
      ) : null}
    </td>
  );
}
