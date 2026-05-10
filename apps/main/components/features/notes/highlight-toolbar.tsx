"use client";

import { useEffect, useState } from "react";
import { HighlighterIcon, QuoteIcon } from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";

type Position = { top: number; left: number };

type Props = {
  /** Pixel position on the screen (already accounts for scroll). */
  position: Position | null;
  /** Selected text. Used to disable buttons when empty. */
  selectionText: string;
  onQuote: () => void;
  onAnnotate: () => void;
  onDismiss: () => void;
};

/**
 * Floating toolbar that appears just above a text selection. Renders into
 * normal flow with absolute positioning over `document.body` is intentionally
 * avoided — the consumer is expected to render this component near the page
 * root so transforms/positioned ancestors don't shift it. Position is in
 * page coordinates (window.scrollY + rect.top, etc.).
 */
export function HighlightToolbar({
  position,
  selectionText,
  onQuote,
  onAnnotate,
  onDismiss,
}: Props) {
  // Hide on Escape — matches popover/dropdown conventions.
  useEffect(() => {
    if (!position) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, onDismiss]);

  if (!position || !selectionText) return null;

  return (
    <div
      style={{ top: position.top, left: position.left }}
      className={cn(
        // `fixed` keeps the toolbar attached to viewport coords so it sits on
        // top of (not inside) any positioned ancestor of the highlighted
        // region. We dismiss on scroll, so it doesn't drift away from its
        // selection.
        "fixed z-40 -translate-x-1/2 -translate-y-full pb-1.5",
        "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
      )}
      data-open=""
      // Stop the document mousedown from clearing the selection before the
      // button click fires.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1 rounded-full border border-border bg-popover px-1 py-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5">
        <button
          type="button"
          onClick={onQuote}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          <QuoteIcon className="size-3.5" />
          Insert as quote
        </button>
        <span aria-hidden className="h-4 w-px bg-border" />
        <button
          type="button"
          onClick={onAnnotate}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          <HighlighterIcon className="size-3.5" />
          Annotate
        </button>
      </div>
    </div>
  );
}

/** Convenience: holds + manages the selection state used by `Highlightable`. */
export function useTextSelection(rootRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<{
    text: string;
    position: Position;
  } | null>(null);

  useEffect(() => {
    function captureSelection() {
      const root = rootRef.current;
      if (!root) {
        setSelection(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      // Selection has to live inside our wrapper for the toolbar to apply.
      const container = range.commonAncestorContainer;
      const node =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as HTMLElement);
      if (!node || !root.contains(node)) {
        setSelection(null);
        return;
      }
      const text = sel.toString();
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      // Viewport-relative — pairs with the `fixed`-positioned toolbar so we
      // sit precisely above the selection irrespective of any positioned
      // ancestors (e.g. our own Highlightable wrapper which is `relative`).
      setSelection({
        text: trimmed,
        position: {
          top: rect.top,
          left: rect.left + rect.width / 2,
        },
      });
    }

    function clear() {
      setSelection(null);
    }

    document.addEventListener("mouseup", captureSelection);
    document.addEventListener("touchend", captureSelection);
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) clear();
    });
    window.addEventListener("scroll", clear, { passive: true });
    return () => {
      document.removeEventListener("mouseup", captureSelection);
      document.removeEventListener("touchend", captureSelection);
      window.removeEventListener("scroll", clear);
    };
  }, [rootRef]);

  return { selection, clearSelection: () => setSelection(null) };
}
