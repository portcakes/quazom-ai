"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PenLineIcon, Trash2Icon } from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@quazom-ai/ui/components/ui/popover";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Markdown } from "@/components/shared/markdown";
import {
  ANNOTATION_TEXT_MAX_LENGTH,
  type AnnotationColor,
} from "@/inngest/schemas";
import {
  ANNOTATION_COLOR_ORDER,
  ANNOTATION_HIGHLIGHT_BASE,
  ANNOTATION_HIGHLIGHT_INTERACTIVE,
  ANNOTATION_LABEL,
  ANNOTATION_SWATCH,
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

// hast node stubs — minimal shape used by our walker. react-markdown gives us
// a `root` element whose children are block elements; both `root` and
// `element` nodes expose a `children` array.
type HastText = { type: "text"; value: string };
type HastElement = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
};
type HastContainer = { type?: string; children: HastNode[] };
type HastNode = HastText | HastElement | HastContainer;

type LeafRef = {
  node: HastText;
  parent: HastContainer;
  indexInParent: number;
};

type CharSource = { leafIdx: number; offset: number } | null;

// Block-level elements: when we cross one of these we emit a virtual "\n"
// in the flat text so a selection that spans across paragraphs/headings can
// still match (the browser's `selection.toString()` does the same).
const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "td",
  "th",
  "dt",
  "dd",
  "figcaption",
  "caption",
  "summary",
]);

// Already-wrapped text is invisible to subsequent passes. This is what keeps
// (a) overlapping annotations from creating nested `<mark>`s, and
// (b) the iterate-until-no-match loop from spinning on its own output.
const SKIP_TAGS = new Set(["mark"]);

function isText(n: HastNode): n is HastText {
  return n.type === "text";
}
function isElement(n: HastNode): n is HastElement {
  return n.type === "element";
}

/**
 * Walk the tree top-down collecting every leaf text node (in document order)
 * along with a flat string representation. Whenever we cross into / out of a
 * block-level element we emit a `\n` separator that doesn't belong to any
 * leaf — that's what allows quotes selected across paragraphs/headings to
 * line up with the flat text once both are whitespace-normalized.
 */
function buildFlat(root: HastContainer): {
  leaves: LeafRef[];
  flat: string;
  charSource: CharSource[];
} {
  const leaves: LeafRef[] = [];
  let flat = "";
  const charSource: CharSource[] = [];
  // Suppress leading separators by pretending we just emitted one.
  let lastWasSeparator = true;

  function emit(value: string, source: CharSource) {
    for (let i = 0; i < value.length; i++) {
      flat += value.charAt(i);
      charSource.push(
        source
          ? { leafIdx: source.leafIdx, offset: source.offset + i }
          : null,
      );
    }
  }

  function maybeSeparator() {
    if (lastWasSeparator) return;
    emit("\n", null);
    lastWasSeparator = true;
  }

  function walk(node: HastNode, parent: HastContainer, indexInParent: number) {
    if (isText(node)) {
      const value = node.value ?? "";
      if (value.length === 0) return;
      const leafIdx = leaves.length;
      leaves.push({ node, parent, indexInParent });
      emit(value, { leafIdx, offset: 0 });
      lastWasSeparator = false;
      return;
    }
    if (!isElement(node)) return;
    if (SKIP_TAGS.has(node.tagName)) return;
    const isBlock = BLOCK_TAGS.has(node.tagName);
    if (isBlock) maybeSeparator();
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      walk(children[i]!, node, i);
    }
    if (isBlock) maybeSeparator();
  }

  const children = root.children ?? [];
  for (let i = 0; i < children.length; i++) {
    walk(children[i]!, root, i);
  }

  return { leaves, flat, charSource };
}

/**
 * Collapse runs of whitespace in `flat` to a single space and return a map
 * from each char in the normalized result back to its index in `flat`. The
 * map lets us trace a normalized-text match back to the original leaves.
 * Leading whitespace is suppressed; at most one trailing space is kept.
 */
function normalizeFlat(flat: string): { normalized: string; map: number[] } {
  let normalized = "";
  const map: number[] = [];
  let prevWS = true;
  for (let i = 0; i < flat.length; i++) {
    const c = flat.charAt(i);
    if (/\s/.test(c)) {
      if (!prevWS) {
        normalized += " ";
        map.push(i);
        prevWS = true;
      }
    } else {
      normalized += c;
      map.push(i);
      prevWS = false;
    }
  }
  return { normalized, map };
}

/** Mirror normalizeFlat for a user-supplied quote (no need to track map). */
function normalizeQuote(quote: string): string {
  return quote.replace(/\s+/g, " ").trim();
}

/**
 * Find every non-overlapping occurrence of `quoteNorm` in the normalized
 * flat text. Each result is expressed in terms of leaves + offsets; virtual
 * block separators (charSource === null) at the very start/end of a match
 * are trimmed so we don't try to wrap something that isn't a real leaf.
 */
function findMatches(
  normalized: string,
  map: number[],
  charSource: CharSource[],
  quoteNorm: string,
): Array<{
  startLeafIdx: number;
  startOffset: number;
  endLeafIdx: number;
  endOffset: number;
}> {
  const out: Array<{
    startLeafIdx: number;
    startOffset: number;
    endLeafIdx: number;
    endOffset: number;
  }> = [];
  if (quoteNorm.length === 0) return out;

  let from = 0;
  while (from <= normalized.length - quoteNorm.length) {
    const idx = normalized.indexOf(quoteNorm, from);
    if (idx === -1) break;
    const endNorm = idx + quoteNorm.length;

    let startFlat = map[idx] ?? -1;
    while (
      startFlat >= 0 &&
      startFlat < charSource.length &&
      charSource[startFlat] === null
    ) {
      startFlat++;
    }
    let endFlat = map[endNorm - 1] ?? -1;
    while (endFlat >= 0 && charSource[endFlat] === null) {
      endFlat--;
    }
    if (
      startFlat < 0 ||
      endFlat < 0 ||
      startFlat >= charSource.length ||
      startFlat > endFlat
    ) {
      from = endNorm;
      continue;
    }
    const startSource = charSource[startFlat]!;
    const endSource = charSource[endFlat]!;
    out.push({
      startLeafIdx: startSource.leafIdx,
      startOffset: startSource.offset,
      endLeafIdx: endSource.leafIdx,
      endOffset: endSource.offset + 1, // exclusive
    });
    from = endNorm;
  }
  return out;
}

/**
 * Splice each leaf in `[startLeafIdx, endLeafIdx]` with
 * `[pre?, <mark>middle</mark>, post?]`. Process in reverse leaf order: each
 * splice only affects indices *after* the spliced position within its own
 * parent, and we never re-touch a leaf, so the recorded `indexInParent`
 * stays valid for the still-pending leaves.
 */
function applyMatch(
  leaves: LeafRef[],
  match: {
    startLeafIdx: number;
    startOffset: number;
    endLeafIdx: number;
    endOffset: number;
  },
  annotationId: string,
) {
  for (let li = match.endLeafIdx; li >= match.startLeafIdx; li--) {
    const leaf = leaves[li];
    if (!leaf) continue;
    const value = leaf.node.value ?? "";
    const isStart = li === match.startLeafIdx;
    const isEnd = li === match.endLeafIdx;
    const sliceStart = isStart ? match.startOffset : 0;
    const sliceEnd = isEnd ? match.endOffset : value.length;
    const pre = value.slice(0, sliceStart);
    const middle = value.slice(sliceStart, sliceEnd);
    const post = value.slice(sliceEnd);
    if (!middle) continue;

    const replacement: HastNode[] = [];
    if (pre) replacement.push({ type: "text", value: pre });
    replacement.push({
      type: "element",
      tagName: "mark",
      properties: { dataAnnotId: annotationId },
      children: [{ type: "text", value: middle }],
    });
    if (post) replacement.push({ type: "text", value: post });

    leaf.parent.children.splice(leaf.indexInParent, 1, ...replacement);
  }
}

/**
 * Wrap every occurrence of `annotation.quote` in the tree. We re-walk after
 * each wrap because the splice mutates the tree (and the wrapped region is
 * now inside a `<mark>`, which `buildFlat` skips — so the next iteration
 * sees the *next* occurrence rather than re-matching the one we just wrapped).
 * `MAX_ITER` is a defensive cap; in practice most annotations wrap once.
 */
function wrapAnnotation(
  root: HastContainer,
  annotation: AnnotationForRender,
) {
  const quoteNorm = normalizeQuote(annotation.quote);
  if (quoteNorm.length === 0) return;
  const MAX_ITER = 50;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const { leaves, flat, charSource } = buildFlat(root);
    const { normalized, map } = normalizeFlat(flat);
    const matches = findMatches(normalized, map, charSource, quoteNorm);
    if (matches.length === 0) return;
    applyMatch(leaves, matches[0]!, annotation.id);
  }
}

/**
 * Markdown renderer that highlights stored annotation quotes inline. Each
 * matching passage is wrapped in a `<mark>` whose hover card surfaces the
 * user's commentary (and a delete button).
 *
 * Highlights can span inline formatting (bold, italic, code, links, …) and
 * block boundaries (heading → paragraph, list item → list item). Matching is
 * whitespace-insensitive — the browser's `selection.toString()` inserts
 * newlines between blocks that don't exist in the source markdown, so we
 * normalize both sides before doing the lookup.
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
      const root = tree as HastContainer;
      for (const a of sorted) wrapAnnotation(root, a);
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
          // No matching annotation in the cache (stale render, etc.): fall
          // back to a plain coloured highlight with no popover.
          if (!annot) {
            const colorKey: AnnotationColor = "YELLOW";
            return (
              <mark className={ANNOTATION_HIGHLIGHT_BASE[colorKey]}>{c}</mark>
            );
          }
          // Every real annotation (commentary or colour-only) gets the
          // interactive popover so the user can change the colour or clear
          // the highlight.
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

  // `listAnnotations` is cached as an array per `{lessonId | resourceId}`. We
  // use `pathFilter()` (matches all of them) so a single mutation updates
  // every cached view in one go — keeps the highlight color/removal in sync
  // across e.g. the lesson body and the resource panel.
  type CachedAnnotation = {
    id: string;
    quote: string;
    annotation: string | null;
    color?: AnnotationColor | null;
    [extra: string]: unknown;
  };

  const recolor = useMutation(
    trpc.updateAnnotation.mutationOptions({
      // Optimistic: flip the color in the cache immediately so the
      // highlight repaints without waiting for the round trip.
      onMutate: async ({ id, color }) => {
        if (!color) return { snapshot: [] };
        const filter = trpc.listAnnotations.pathFilter();
        await queryClient.cancelQueries(filter);
        const snapshot = queryClient.getQueriesData(filter);
        queryClient.setQueriesData(filter, (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return (old as CachedAnnotation[]).map((a) =>
            a.id === id ? { ...a, color } : a,
          );
        });
        return { snapshot };
      },
      onError: (err, _vars, ctx) => {
        if (ctx?.snapshot) {
          for (const [key, data] of ctx.snapshot) {
            queryClient.setQueryData(key, data);
          }
        }
        toast.error(err.message ?? "Failed to change colour");
      },
      onSettled: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.listAnnotations.pathKey(),
        });
        // The auto-managed annotations note embeds the highlight colour, so
        // re-fetch listNotes too.
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
      },
    }),
  );

  const remove = useMutation(
    trpc.deleteAnnotation.mutationOptions({
      // Optimistic: drop the annotation from the cache so the `<mark>` is
      // gone the moment the user clicks.
      onMutate: async ({ id }) => {
        const filter = trpc.listAnnotations.pathFilter();
        await queryClient.cancelQueries(filter);
        const snapshot = queryClient.getQueriesData(filter);
        queryClient.setQueriesData(filter, (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return (old as CachedAnnotation[]).filter((a) => a.id !== id);
        });
        return { snapshot };
      },
      onError: (err, _vars, ctx) => {
        if (ctx?.snapshot) {
          for (const [key, data] of ctx.snapshot) {
            queryClient.setQueryData(key, data);
          }
        }
        toast.error(err.message ?? "Failed to clear highlight");
      },
      onSuccess: () => {
        toast.success("Highlight cleared");
      },
      onSettled: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.listAnnotations.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
      },
    }),
  );

  // Inline note editor. Driven by `editing`; the textarea lives in the
  // popover body and replaces the view-mode chrome (swatches + Remove)
  // while open so the user can focus on writing.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when entering edit mode — autoFocus on the element
  // itself races with the popover's open animation and sometimes loses.
  useEffect(() => {
    if (editing) {
      // Defer to the next tick so the textarea is in the DOM.
      const id = window.setTimeout(() => {
        textareaRef.current?.focus();
        // Drop the caret at the end of any pre-filled text.
        const len = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(len, len);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [editing]);

  const saveNote = useMutation(
    trpc.updateAnnotation.mutationOptions({
      // Optimistic: update the commentary in the cache so the popover
      // re-renders with the new note text immediately on save.
      onMutate: async ({ id, annotation: nextAnnotation }) => {
        if (nextAnnotation === undefined) return { snapshot: [] };
        const filter = trpc.listAnnotations.pathFilter();
        await queryClient.cancelQueries(filter);
        const snapshot = queryClient.getQueriesData(filter);
        queryClient.setQueriesData(filter, (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return (old as CachedAnnotation[]).map((a) =>
            a.id === id ? { ...a, annotation: nextAnnotation } : a,
          );
        });
        return { snapshot };
      },
      onError: (err, _vars, ctx) => {
        if (ctx?.snapshot) {
          for (const [key, data] of ctx.snapshot) {
            queryClient.setQueryData(key, data);
          }
        }
        toast.error(err.message ?? "Failed to save note");
      },
      onSuccess: () => {
        setEditing(false);
        setDraft("");
      },
      onSettled: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.listAnnotations.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.listNotes.pathKey(),
        });
      },
    }),
  );

  // Hover-open is desktop-only; touch users tap. Synthetic mouse events
  // fire after touch on iOS, so gating on coarse-pointer detection keeps
  // the popover from flickering open during a tap-and-scroll gesture.
  // While editing we also disable the hover-close timer entirely so a
  // mouse drift away from the popover doesn't yank the textarea out from
  // under the user mid-typing.
  const hoverProps =
    isCoarsePointer || editing
      ? {}
      : {
          onMouseEnter: () => {
            cancelHoverClose();
            setOpen(true);
          },
          onMouseLeave: scheduleHoverClose,
        };

  const colorKey: AnnotationColor = annotation.color ?? "YELLOW";
  const hasCommentary = Boolean(annotation.annotation?.trim());
  // Always use the interactive style now that every highlight has a
  // popover — the dotted underline is the visual cue that the mark is
  // clickable.
  const interactiveClass = `${ANNOTATION_HIGHLIGHT_INTERACTIVE[colorKey]} cursor-pointer`;
  const busy = recolor.isPending || remove.isPending || saveNote.isPending;

  const draftTrimmed = draft.trim();
  const draftOverLimit = draftTrimmed.length > ANNOTATION_TEXT_MAX_LENGTH;
  const currentNote = annotation.annotation ?? "";

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Discard any in-flight edit so the next open starts in view mode.
      setEditing(false);
      setDraft("");
    }
  };

  const startEditing = () => {
    setDraft(currentNote);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft("");
  };

  const handleSaveNote = () => {
    if (draftOverLimit) return;
    // Send `null` to clear the note entirely; otherwise send the trimmed
    // string. Keeps the cache shape consistent with what the server stores.
    const next: string | null = draftTrimmed.length === 0 ? null : draftTrimmed;
    if (next === currentNote || (next === null && !hasCommentary)) {
      cancelEditing();
      return;
    }
    saveNote.mutate({ id: annotation.id, annotation: next });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
        <div className="flex flex-col gap-3">
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Cmd/Ctrl+Enter to save; Escape to cancel without
                  // closing the popover. Stop propagation so the mark's
                  // own keydown handler doesn't also see them.
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    cancelEditing();
                  } else if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSaveNote();
                  }
                }}
                placeholder="What should you remember about this passage?"
                className="min-h-[96px] text-sm"
                disabled={saveNote.isPending}
              />
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={
                    draftOverLimit
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {draftTrimmed.length} / {ANNOTATION_TEXT_MAX_LENGTH}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 cursor-pointer"
                    disabled={saveNote.isPending}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 cursor-pointer"
                    disabled={draftOverLimit || saveNote.isPending}
                    onClick={handleSaveNote}
                  >
                    {saveNote.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {hasCommentary ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {annotation.annotation}
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 cursor-pointer justify-start"
                disabled={busy}
                onClick={startEditing}
              >
                <PenLineIcon className="size-3.5" />
                {hasCommentary ? "Edit note" : "Add note"}
              </Button>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {ANNOTATION_COLOR_ORDER.map((c) => {
                    const active = c === colorKey;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Change highlight to ${ANNOTATION_LABEL[c]}`}
                        aria-pressed={active}
                        title={ANNOTATION_LABEL[c]}
                        disabled={busy}
                        onClick={() => {
                          // No-op when clicking the already-active colour so
                          // we don't fire a pointless write.
                          if (active) return;
                          recolor.mutate({ id: annotation.id, color: c });
                        }}
                        className={cn(
                          "size-5 cursor-pointer rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover disabled:cursor-not-allowed disabled:opacity-60",
                          ANNOTATION_SWATCH[c],
                          active &&
                            "ring-2 ring-foreground/50 ring-offset-2 ring-offset-popover",
                        )}
                      />
                    );
                  })}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 cursor-pointer text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => remove.mutate({ id: annotation.id })}
                >
                  <Trash2Icon className="size-3.5" />
                  Remove
                </Button>
              </div>
            </>
          )}
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
