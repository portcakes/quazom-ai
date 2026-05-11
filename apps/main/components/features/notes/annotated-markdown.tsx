"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { visit } from "unist-util-visit";
import { Trash2Icon } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@quazom-ai/ui/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@quazom-ai/ui/components/ui/popover";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { Markdown } from "@/components/shared/markdown";

export type AnnotationForRender = {
  id: string;
  quote: string;
  annotation: string;
};

type Props = {
  /** Markdown source. Untouched; the rehype plugin walks the parsed tree. */
  children: string;
  annotations: AnnotationForRender[];
  /** Smaller scale for tight contexts. Forwarded to `<Markdown>`. */
  compact?: boolean;
  className?: string;
  /** Allow inline HTML in the source (e.g. user-authored notes). */
  allowInlineHtml?: boolean;
};

/**
 * Markdown renderer that highlights stored annotation quotes inline. Each
 * matching passage is wrapped in a `<mark>` whose hover card surfaces the
 * user's commentary (and a delete button). Annotations whose quote can't be
 * found in the rendered text — typically because the highlight crossed a
 * markdown boundary — are silently skipped here; they still appear in the
 * lesson's auto-managed annotations note.
 */
export function AnnotatedMarkdown({
  children,
  annotations,
  compact,
  className,
  allowInlineHtml,
}: Props) {
  // Sort so longer quotes win when they overlap with a shorter one. Without
  // this we'd consume the prefix of a longer quote with a shorter match.
  const sorted = useMemo(() => {
    return [...annotations]
      .filter((a) => a.quote.trim().length > 0)
      .sort((a, b) => b.quote.length - a.quote.length);
  }, [annotations]);

  const annotationMap = useMemo(() => {
    const m = new Map<string, AnnotationForRender>();
    for (const a of sorted) m.set(a.id, a);
    return m;
  }, [sorted]);

  const rehypePlugin = useMemo(() => {
    return () => (tree: unknown) => {
      visit(tree as never, "text", (node, index, parent) => {
        if (!parent || typeof index !== "number") return;
        const original: string = (node as { value?: string }).value ?? "";
        if (!original) return;

        // Try each annotation. We rebuild the text node into a sequence of
        // text + mark nodes when we find a match. We only handle one match
        // per pass to keep replacement deterministic; subsequent matches in
        // the same string get picked up on the next visit since the visitor
        // re-walks the new children.
        for (const a of sorted) {
          const idx = original.indexOf(a.quote);
          if (idx === -1) continue;

          const before = original.slice(0, idx);
          const matched = original.slice(idx, idx + a.quote.length);
          const after = original.slice(idx + a.quote.length);

          const replacement = [];
          if (before) {
            replacement.push({ type: "text", value: before });
          }
          replacement.push({
            type: "element",
            tagName: "mark",
            properties: {
              dataAnnotId: a.id,
            },
            children: [{ type: "text", value: matched }],
          });
          if (after) {
            replacement.push({ type: "text", value: after });
          }

          // Splice the new nodes into the parent's children.
          (parent as { children: unknown[] }).children.splice(
            index,
            1,
            ...replacement,
          );
          // Bail out — visit will pick up the inserted nodes on its own.
          return;
        }
      });
    };
  }, [sorted]);

  return (
    <Markdown
      compact={compact}
      className={className}
      allowInlineHtml={allowInlineHtml}
      // The plugin we hand-roll here is a rehype plugin (works on the hast
      // tree); pass it through Markdown's componentsOverride only — the
      // plugin itself runs via a small monkey-patch below.
      componentsOverride={{
        mark: ({ children: c, ...props }) => {
          // react-markdown surfaces data-* hast properties on the React
          // element under their kebab-cased attribute name.
          const id =
            (props as { "data-annot-id"?: string })["data-annot-id"] ??
            (props as { dataAnnotId?: string }).dataAnnotId;
          const annot = id ? annotationMap.get(id) : null;
          if (!annot) {
            return (
              <mark className="rounded-sm bg-yellow-200/50 px-0.5 dark:bg-yellow-400/20">
                {c}
              </mark>
            );
          }
          return <AnnotationMark annotation={annot}>{c}</AnnotationMark>;
        },
      }}
      rehypePluginsExtra={[rehypePlugin]}
    >
      {children}
    </Markdown>
  );
}

function AnnotationMark({
  annotation,
  children,
}: {
  annotation: AnnotationForRender;
  children: React.ReactNode;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isCoarsePointer = useIsCoarsePointer();

  const remove = useMutation(
    trpc.deleteAnnotation.mutationOptions({
      onSuccess: () => {
        toast.success("Annotation removed");
        void queryClient.invalidateQueries({
          queryKey: trpc.listAnnotations.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
      },
      onError: (err) => toast.error(err.message ?? "Failed to delete"),
    }),
  );

  const body = (
    <div className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {annotation.annotation}
      </p>
      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 cursor-pointer text-destructive hover:text-destructive"
          disabled={remove.isPending}
          onClick={() => remove.mutate({ id: annotation.id })}
        >
          <Trash2Icon className="size-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );

  const trigger = (
    // `mark` is the inline highlighted text. On touch we make it explicitly
    // tappable (role=button + tabIndex) so the Popover trigger fires
    // reliably; on desktop the cursor hint is enough.
    <mark
      role={isCoarsePointer ? "button" : undefined}
      tabIndex={isCoarsePointer ? 0 : undefined}
      className={
        isCoarsePointer
          ? "cursor-pointer rounded-sm bg-yellow-200/60 px-0.5 underline decoration-yellow-700/50 decoration-dotted underline-offset-4 dark:bg-yellow-400/25 dark:decoration-yellow-300/60"
          : "cursor-help rounded-sm bg-yellow-200/60 px-0.5 underline decoration-yellow-700/50 decoration-dotted underline-offset-4 dark:bg-yellow-400/25 dark:decoration-yellow-300/60"
      }
    >
      {children}
    </mark>
  );

  // Radix HoverCard listens for pointerenter/leave through passive event
  // listeners — on iOS Safari those never fire a "hover", so the card
  // never opens AND the engine logs "Unable to preventDefault inside
  // passive event listener invocation" when it tries to suppress the
  // synthetic click. Swap in a tap-driven Popover for coarse pointers.
  if (isCoarsePointer) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          className="w-80"
          // Keep the page from scrolling/jumping when the popover opens
          // from an inline element near the viewport edge.
          collisionPadding={12}
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent className="w-80">{body}</HoverCardContent>
    </HoverCard>
  );
}

/**
 * `true` when the primary input is touch (or otherwise can't hover) — i.e.
 * phones and tablets. Defaults to `false` during SSR so the desktop
 * HoverCard branch is rendered initially and we don't ship an unnecessary
 * Popover bundle to keyboard/mouse users. We then update on mount and
 * subscribe to changes (e.g. plugging in a mouse on a 2-in-1).
 */
function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: none), (pointer: coarse)");
    setCoarse(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return coarse;
}
