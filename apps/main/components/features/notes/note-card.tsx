"use client";

import { BookIcon, GraduationCapIcon, HighlighterIcon } from "lucide-react";
import Link from "next/link";

export type NoteCardData = {
  id: string;
  title: string | null;
  description?: string | null;
  content: string;
  isAnnotation?: boolean;
  lessonId: string | null;
  curriculumId: string | null;
  updatedAt: Date | string;
  lesson: { id: string; title: string; curriculumId: string } | null;
  curriculum: { id: string; title: string } | null;
};

type Props = {
  note: NoteCardData;
};

/**
 * Square note tile used in /notes and curriculum/lesson notes panels. The
 * card is a plain anchor (not a button) so middle-click / cmd-click open the
 * dedicated note page in a new tab — the natural expectation for a tile.
 */
export function NoteCard({ note }: Props) {
  const updated =
    typeof note.updatedAt === "string"
      ? new Date(note.updatedAt)
      : note.updatedAt;

  // Description preferred when present; otherwise show the body preview with
  // markdown markers stripped so the tile reads cleanly.
  const preview = (note.description?.trim() || stripMarkdown(note.content))
    .slice(0, 280);

  return (
    <Link
      href={`/notes/${note.id}`}
      className="group flex aspect-square min-w-0 flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-sidebar-accent/40 hover:ring-1 hover:ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words font-heading text-base font-semibold leading-snug line-clamp-2">
          {note.title?.trim() || "Untitled note"}
        </h3>
        <time
          dateTime={updated.toISOString()}
          className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
          title={updated.toLocaleString()}
        >
          {formatRelative(updated)}
        </time>
      </div>
      <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {preview}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-xs text-muted-foreground">
        {note.isAnnotation ? (
          <ContextChip icon={<HighlighterIcon className="size-3" />}>
            Annotations
          </ContextChip>
        ) : null}
        {note.curriculum ? (
          <ContextChip icon={<GraduationCapIcon className="size-3" />}>
            {note.curriculum.title}
          </ContextChip>
        ) : null}
        {note.lesson ? (
          <ContextChip icon={<BookIcon className="size-3" />}>
            {note.lesson.title}
          </ContextChip>
        ) : null}
      </div>
    </Link>
  );
}

// Static badge — the surrounding card is already a `<Link>` to the note page,
// so nesting another link would be invalid HTML. The note page itself
// surfaces clickable links back to the curriculum/lesson.
function ContextChip({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

const RELATIVE_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.345, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

function formatRelative(date: Date): string {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let duration = (date.getTime() - Date.now()) / 1000;
  for (const div of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < div.amount) {
      return formatter.format(Math.round(duration), div.unit);
    }
    duration /= div.amount;
  }
  return date.toLocaleDateString();
}

// Quick-and-dirty markdown stripper for the card preview. We don't render
// markdown inside the tile — that would produce inconsistent heights — so
// we just collapse the most common markers to readable plain text.
function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/<\/?u>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
