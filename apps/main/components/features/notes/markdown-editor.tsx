"use client";

import { useCallback, useId, useRef } from "react";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  UnderlineIcon,
} from "lucide-react";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { cn } from "@quazom-ai/ui/lib/utils";

type ToolbarAction =
  | { kind: "wrap"; left: string; right: string }
  | { kind: "linePrefix"; prefix: string }
  | { kind: "block"; lineStart: string };

type ToolbarButton = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: ToolbarAction;
};

const TOOLBAR: ToolbarButton[] = [
  { id: "h1", label: "Heading 1", icon: Heading1Icon, action: { kind: "linePrefix", prefix: "# " } },
  { id: "h2", label: "Heading 2", icon: Heading2Icon, action: { kind: "linePrefix", prefix: "## " } },
  { id: "h3", label: "Heading 3", icon: Heading3Icon, action: { kind: "linePrefix", prefix: "### " } },
  { id: "bold", label: "Bold", icon: BoldIcon, action: { kind: "wrap", left: "**", right: "**" } },
  { id: "italic", label: "Italic", icon: ItalicIcon, action: { kind: "wrap", left: "*", right: "*" } },
  {
    id: "underline",
    label: "Underline",
    icon: UnderlineIcon,
    action: { kind: "wrap", left: "<u>", right: "</u>" },
  },
  { id: "code", label: "Inline code", icon: CodeIcon, action: { kind: "wrap", left: "`", right: "`" } },
  { id: "ul", label: "Bulleted list", icon: ListIcon, action: { kind: "linePrefix", prefix: "- " } },
  {
    id: "ol",
    label: "Numbered list",
    icon: ListOrderedIcon,
    action: { kind: "linePrefix", prefix: "1. " },
  },
  { id: "quote", label: "Quote", icon: QuoteIcon, action: { kind: "linePrefix", prefix: "> " } },
];

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  /** Min textarea height in tailwind class form (e.g. `min-h-[260px]`). */
  minHeightClass?: string;
  /**
   * Explicit pixel height for the textarea, overriding `minHeightClass`. Use
   * this when a parent wants to drive the height directly (e.g. a draggable
   * bottom-sheet that resizes the editor below it).
   */
  heightPx?: number;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Markdown editor with a small toolbar that wraps or prefixes the current
 * selection. Intentionally textarea-based (not a full WYSIWYG) so the value
 * stored is always plain markdown that round-trips through our `<Markdown>`
 * renderer without surprises. Underline emits `<u>...</u>` which the
 * renderer maps to a styled element when `allowInlineHtml` is on.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write your note…",
  className,
  minHeightClass = "min-h-[260px]",
  heightPx,
  disabled,
  autoFocus,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();

  const apply = useCallback(
    (action: ToolbarAction) => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const v = el.value;
      const before = v.slice(0, start);
      const selected = v.slice(start, end);
      const after = v.slice(end);

      let next = v;
      let nextStart = start;
      let nextEnd = end;

      if (action.kind === "wrap") {
        const { left, right } = action;
        // Toggle off when the selection is already wrapped — keeps the toolbar
        // a true on/off rather than spamming markers on repeat clicks.
        if (
          selected.length > 0 &&
          before.endsWith(left) &&
          after.startsWith(right)
        ) {
          next = before.slice(0, -left.length) + selected + after.slice(right.length);
          nextStart = start - left.length;
          nextEnd = end - left.length;
        } else {
          next = `${before}${left}${selected || ""}${right}${after}`;
          nextStart = start + left.length;
          nextEnd = nextStart + selected.length;
        }
      } else if (action.kind === "linePrefix") {
        // Apply to every line in the selection (or just the current line when
        // the selection is collapsed).
        const lineStart = before.lastIndexOf("\n") + 1;
        const trailingNewline = after.indexOf("\n");
        const lineEnd = trailingNewline === -1 ? v.length : end + trailingNewline;
        const block = v.slice(lineStart, lineEnd);
        const prefixed = block
          .split("\n")
          .map((line) => (line.startsWith(action.prefix) ? line : `${action.prefix}${line}`))
          .join("\n");
        next = v.slice(0, lineStart) + prefixed + v.slice(lineEnd);
        const delta = prefixed.length - block.length;
        nextStart = start + (selected.length === 0 ? action.prefix.length : 0);
        nextEnd = end + delta;
      } else if (action.kind === "block") {
        next = `${before}${action.lineStart}${selected}${after}`;
        nextStart = start + action.lineStart.length;
        nextEnd = nextStart + selected.length;
      }

      onChange(next);
      // Restore the cursor / selection after React re-renders the textarea.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextStart, nextEnd);
      });
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {TOOLBAR.map((btn, idx) => {
          const Icon = btn.icon;
          // Visual separators between groups for legibility.
          const showDivider = idx === 3 || idx === 6 || idx === 9;
          return (
            <span key={btn.id} className="flex items-center">
              <button
                type="button"
                aria-label={btn.label}
                title={btn.label}
                disabled={disabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  apply(btn.action);
                }}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon className="size-4" />
              </button>
              {showDivider ? (
                <span
                  aria-hidden
                  className="mx-1 h-5 w-px bg-border/80"
                />
              ) : null}
            </span>
          );
        })}
      </div>
      <Textarea
        id={textareaId}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        // When `heightPx` is set, fix the height precisely so the textarea
        // body can scroll internally instead of the parent reflowing.
        style={
          typeof heightPx === "number"
            ? { height: `${heightPx}px`, minHeight: `${heightPx}px` }
            : undefined
        }
        className={cn(
          "font-mono text-sm leading-relaxed",
          typeof heightPx === "number" ? "resize-none" : minHeightClass,
        )}
      />
    </div>
  );
}
