"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookIcon,
  GraduationCapIcon,
  LibraryIcon,
  LinkIcon as LinkPlusIcon,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@quazom-ai/ui/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@quazom-ai/ui/components/ui/command";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Switch } from "@quazom-ai/ui/components/ui/switch";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";

type SourceKind = "curriculum" | "lesson" | "resource";

type SourceItem = {
  id: string;
  title: string;
  kind: SourceKind;
  href: string;
  subtitle?: string;
};

/**
 * Toolbar entry point that lets the writer drop a clickable reference to one
 * of their curricula, lessons, or resources into the note. Two insertion
 * modes are supported:
 *
 *  - **Badge** (default): renders as a pill-shaped chip via the editor's
 *    `a[data-source-badge="true"]` CSS hook.
 *  - **Text**: renders as a normal inline link with the source's title as
 *    the visible text.
 *
 * Both modes carry a `data-source-type` attribute so future tooling (PDF
 * export, hover cards, etc.) can recognise these as Quazom links rather
 * than arbitrary URLs the user pasted.
 */
export function InsertSourceLinkPopover({ editor }: { editor: Editor | null }) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [asBadge, setAsBadge] = useState(true);
  const [query, setQuery] = useState("");

  // Lazy: only fetch when the popover opens so we don't load the picker
  // payload for every editor on the page.
  const sourcesQuery = useQuery(
    trpc.listContinuityLinkSources.queryOptions(undefined, {
      enabled: open,
      staleTime: 60_000,
    }),
  );

  const items = useMemo<SourceItem[]>(() => {
    const data = sourcesQuery.data;
    if (!data) return [];
    const flat: SourceItem[] = [];
    for (const c of data.curricula) {
      flat.push({
        id: c.id,
        title: c.title,
        kind: "curriculum",
        href: `/curricula/${c.id}`,
      });
    }
    for (const l of data.lessons) {
      flat.push({
        id: l.id,
        title: l.title,
        kind: "lesson",
        href: `/lessons/${l.id}`,
        subtitle: l.curriculumTitle,
      });
    }
    for (const r of data.resources) {
      flat.push({
        id: r.id,
        title: r.title,
        kind: "resource",
        href: `/resources/${r.id}`,
      });
    }
    return flat;
  }, [sourcesQuery.data]);

  const handlePick = (item: SourceItem) => {
    if (!editor) return;
    const text = item.title.trim() || "Untitled";
    // We compose the insertion in two steps so the link mark only wraps
    // the text we just inserted (not the user's existing selection).
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text,
        marks: [
          {
            type: "link",
            attrs: {
              href: item.href,
              "data-source-type": item.kind,
              "data-source-badge": asBadge ? "true" : null,
            },
          },
        ],
      })
      // Insert a trailing space so the user can keep typing without the
      // link mark "eating" their next characters.
      .insertContent(" ")
      .run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Insert link to a course, lesson, or resource"
          title="Insert source link"
          disabled={!editor}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LinkPlusIcon className="size-4" />
          Source
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <Label
            htmlFor="cn-source-badge"
            className="text-xs font-medium text-muted-foreground"
          >
            Insert as badge
          </Label>
          <Switch
            id="cn-source-badge"
            checked={asBadge}
            onCheckedChange={setAsBadge}
          />
        </div>
        <Command shouldFilter>
          <CommandInput
            placeholder="Search courses, lessons, resources…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {sourcesQuery.isLoading
                ? "Loading sources…"
                : "Nothing matches that search."}
            </CommandEmpty>
            {(["curriculum", "lesson", "resource"] as const).map((kind) => {
              const group = items.filter((i) => i.kind === kind);
              if (group.length === 0) return null;
              return (
                <CommandGroup
                  key={kind}
                  heading={KIND_LABEL[kind]}
                  className="text-xs"
                >
                  {group.map((item) => (
                    <CommandItem
                      key={`${item.kind}:${item.id}`}
                      value={`${KIND_LABEL[item.kind]} ${item.title} ${item.subtitle ?? ""}`}
                      onSelect={() => handlePick(item)}
                    >
                      <SourceIcon
                        kind={item.kind}
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{item.title}</span>
                        {item.subtitle ? (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const KIND_LABEL: Record<SourceKind, string> = {
  curriculum: "Courses",
  lesson: "Lessons",
  resource: "Resources",
};

function SourceIcon({
  kind,
  className,
}: {
  kind: SourceKind;
  className?: string;
}) {
  const Icon =
    kind === "curriculum"
      ? GraduationCapIcon
      : kind === "lesson"
        ? BookIcon
        : LibraryIcon;
  return <Icon className={cn(className)} />;
}
