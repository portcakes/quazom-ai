import type { AnnotationColor } from "@/inngest/schemas";

// Static Tailwind class strings indexed by AnnotationColor. We can't generate
// these dynamically because Tailwind's JIT only sees literal strings — every
// class below has to appear verbatim somewhere in the source for the
// compiler to pick it up.
//
// `BASE` is used on `<mark>` elements we render for annotations that already
// have a popover; `INTERACTIVE` is used for the version that opens on hover
// (adds the dotted underline so the user can see it's clickable).

export const ANNOTATION_HIGHLIGHT_BASE: Record<AnnotationColor, string> = {
  YELLOW: "rounded-sm bg-yellow-200/60 px-0.5 dark:bg-yellow-400/25",
  PINK: "rounded-sm bg-pink-200/60 px-0.5 dark:bg-pink-400/25",
  BLUE: "rounded-sm bg-sky-200/60 px-0.5 dark:bg-sky-400/25",
  ORANGE: "rounded-sm bg-orange-200/60 px-0.5 dark:bg-orange-400/30",
  GREEN: "rounded-sm bg-emerald-200/60 px-0.5 dark:bg-emerald-400/25",
};

export const ANNOTATION_HIGHLIGHT_INTERACTIVE: Record<AnnotationColor, string> = {
  YELLOW:
    "rounded-sm bg-yellow-200/60 px-0.5 underline decoration-yellow-700/50 decoration-dotted underline-offset-4 dark:bg-yellow-400/25 dark:decoration-yellow-300/60",
  PINK: "rounded-sm bg-pink-200/60 px-0.5 underline decoration-pink-700/50 decoration-dotted underline-offset-4 dark:bg-pink-400/25 dark:decoration-pink-300/60",
  BLUE: "rounded-sm bg-sky-200/60 px-0.5 underline decoration-sky-700/50 decoration-dotted underline-offset-4 dark:bg-sky-400/25 dark:decoration-sky-300/60",
  ORANGE:
    "rounded-sm bg-orange-200/60 px-0.5 underline decoration-orange-700/50 decoration-dotted underline-offset-4 dark:bg-orange-400/30 dark:decoration-orange-300/60",
  GREEN:
    "rounded-sm bg-emerald-200/60 px-0.5 underline decoration-emerald-700/50 decoration-dotted underline-offset-4 dark:bg-emerald-400/25 dark:decoration-emerald-300/60",
};

// Solid swatches the highlight toolbar / color picker render. Same colour
// family as the highlights, but opaque so the swatch reads clearly outside
// of any text background.
export const ANNOTATION_SWATCH: Record<AnnotationColor, string> = {
  YELLOW: "bg-yellow-300 dark:bg-yellow-400",
  PINK: "bg-pink-300 dark:bg-pink-400",
  BLUE: "bg-sky-300 dark:bg-sky-400",
  ORANGE: "bg-orange-300 dark:bg-orange-400",
  GREEN: "bg-emerald-300 dark:bg-emerald-400",
};

export const ANNOTATION_LABEL: Record<AnnotationColor, string> = {
  YELLOW: "Yellow",
  PINK: "Pink",
  BLUE: "Blue",
  ORANGE: "Orange",
  GREEN: "Green",
};

export const ANNOTATION_COLOR_ORDER: AnnotationColor[] = [
  "YELLOW",
  "PINK",
  "BLUE",
  "ORANGE",
  "GREEN",
];
