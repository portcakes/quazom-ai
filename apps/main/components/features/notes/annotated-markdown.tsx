"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { visit } from "unist-util-visit";
import { Trash2Icon } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@quazom-ai/ui/components/ui/popover";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { Markdown } from "@/components/shared/markdown";
import type { AnnotationColor } from "@/inngest/schemas";
import {
  ANNOTATION_HIGHLIGHT_BASE,
  ANNOTATION_HIGHLIGHT_INTERACTIVE,
} from "@/lib/annotation-colors";

export type AnnotationForRender = {
  id: string;
  quote: string;
  /** `null` for a colour-only highlight (no popover). */
  annotation: string | null;
  /** Highlight colour the user picked from the toolbar. Optional so legacy
   *  callers can drop the field and get the default yellow look. */
  color?: AnnotationColor | null;
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
          const colorKey: AnnotationColor = annot?.color ?? "YELLOW";
          if (!annot) {
            return (
              <mark className={ANNOTATION_HIGHLIGHT_BASE[colorKey]}>{c}</mark>
            );
          }
          // Colour-only highlight (no commentary) ⇒ no popover. Renders as
          // a plain coloured `<mark>` so the user sees the highlight but
          // doesn't get a stub popover with nothing useful in it.
          if (!annot.annotation || annot.annotation.trim().length === 0) {
            return (
              <mark className={ANNOTATION_HIGHLIGHT_BASE[colorKey]}>{c}</mark>
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

  // Controlled open state. We drive the popover ourselves rather than
  // relying on `PopoverTrigger`'s built-in click handling because:
  //   - iOS Safari is flaky about firing `click` on inline non-button
  //     elements even with `cursor: pointer`, so we wire `onClick` /
  //     `onPointerUp` directly on the trigger;
  //   - we want hover-to-open on desktop (fine pointers) without
  //     reaching for Radix's HoverCard (which leaks the well-known
  //     "Unable to preventDefault inside passive event listener" warning
  //     and never actually opens on touch).
  const [open, setOpen] = useState(false);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseTimerRef.current = setTimeout(() => setOpen(false), 150);
  }, [cancelHoverClose]);

  useEffect(() => () => cancelHoverClose(), [cancelHoverClose]);

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

  // Hover-open is desktop-only; touch users tap. Synthetic mouse events
  // fire after touch on iOS, so gating on coarse-pointer detection keeps
  // the popover from flickering open during a tap-and-scroll gesture.
  const hoverProps = isCoarsePointer
    ? {}
    : {
        onMouseEnter: () => {
          cancelHoverClose();
          setOpen(true);
        },
        onMouseLeave: scheduleHoverClose,
      };

  const colorKey: AnnotationColor = annotation.color ?? "YELLOW";
  const interactiveClass = `${ANNOTATION_HIGHLIGHT_INTERACTIVE[colorKey]} ${
    isCoarsePointer ? "cursor-pointer" : "cursor-help"
  }`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <mark
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={open}
          // Toggle on click for everyone; iOS fires `click` on elements
          // that have an `onclick` handler attached, so wiring this here
          // is what makes the trigger reliably tappable.
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            cancelHoverClose();
            setOpen((prev) => !prev);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              cancelHoverClose();
              setOpen((prev) => !prev);
            } else if (event.key === "Escape" && open) {
              setOpen(false);
            }
          }}
          {...hoverProps}
          className={interactiveClass}
        >
          {children}
        </mark>
      </PopoverAnchor>
      <PopoverContent
        className="w-80"
        // Prevent Radix from yanking focus into the popover on open — it
        // would scroll the page on mobile and steal focus from the
        // surrounding selection. The popover's own buttons stay
        // keyboard-reachable via normal Tab order.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Keep the popover from being clipped against the viewport edge
        // when an annotation sits near the screen boundary.
        collisionPadding={12}
        {...(isCoarsePointer
          ? {}
          : {
              onMouseEnter: cancelHoverClose,
              onMouseLeave: scheduleHoverClose,
            })}
      >
        <div className="flex flex-col gap-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {annotation.annotation ?? ""}
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
      </PopoverContent>
    </Popover>
  );
}

/**
 * `true` when the primary input is touch (or otherwise can't hover) — i.e.
 * phones and tablets. Defaults to `false` during SSR so the desktop
 * hover-to-open branch is rendered initially. We then update on mount and
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
