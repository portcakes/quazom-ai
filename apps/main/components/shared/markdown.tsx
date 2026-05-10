"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Pluggable } from "unified";
import { cn } from "@quazom-ai/ui/lib/utils";

type Props = {
  children: string;
  className?: string;
  /** Smaller scale for tight contexts (overviews, hover cards, etc.). */
  compact?: boolean;
  /**
   * Allow a small set of inline HTML tags (currently `<u>` for underline).
   * Use this for content the *user* authored (e.g. notes), never for
   * model-emitted lesson content where a runaway tag could escape.
   */
  allowInlineHtml?: boolean;
  /** Optional override for the components map — extend, don't replace. */
  componentsOverride?: Partial<Components>;
  /** Optional extra rehype plugins (e.g. annotation injector). */
  rehypePluginsExtra?: Pluggable[];
};

// Keep underline limited to a single inline tag the editor toolbar emits.
// We intentionally do *not* enable rehype-sanitize here because we don't
// surface model output through this codepath; user-authored notes go through
// our own length cap + the sanitizing default of react-markdown.
const ALLOWED_RAW_TAGS = new Set(["u"]);

/**
 * Renders markdown using design-system tokens instead of @tailwindcss/typography.
 * Heading scale matches our `font-heading` aesthetic and stays consistent with
 * the rest of the lesson chrome.
 *
 * Treats markdown as untrusted content: we don't enable raw HTML so a
 * model-emitted `<script>` can't sneak through. Pass `allowInlineHtml` to
 * opt in for user-authored content where the markdown editor's underline
 * button needs to round-trip through `<u>...</u>`.
 */
export function Markdown({
  children,
  className,
  compact = false,
  allowInlineHtml = false,
  componentsOverride,
  rehypePluginsExtra,
}: Props) {
  const headingFont = "font-heading font-semibold tracking-tight";
  return (
    <div
      className={cn(
        "min-w-0 break-words text-foreground",
        compact ? "text-sm leading-relaxed" : "text-base leading-relaxed",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          ...(allowInlineHtml ? [rehypeRaw as Pluggable] : []),
          ...(rehypePluginsExtra ?? []),
        ]}
        urlTransform={(url) => url}
        components={
          {
            h1: ({ children: c, ...props }) => (
              <h1
                {...props}
                className={cn(
                  headingFont,
                  compact ? "mt-5 mb-3 text-xl" : "mt-8 mb-4 text-3xl",
                )}
              >
                {c}
              </h1>
            ),
            h2: ({ children: c, ...props }) => (
              <h2
                {...props}
                className={cn(
                  headingFont,
                  compact ? "mt-5 mb-2 text-lg" : "mt-7 mb-3 text-2xl",
                )}
              >
                {c}
              </h2>
            ),
            h3: ({ children: c, ...props }) => (
              <h3
                {...props}
                className={cn(
                  headingFont,
                  compact ? "mt-4 mb-2 text-base" : "mt-6 mb-2 text-xl",
                )}
              >
                {c}
              </h3>
            ),
            h4: ({ children: c, ...props }) => (
              <h4
                {...props}
                className={cn(headingFont, "mt-5 mb-2 text-base")}
              >
                {c}
              </h4>
            ),
            h5: ({ children: c, ...props }) => (
              <h5 {...props} className={cn(headingFont, "mt-4 mb-1 text-sm")}>
                {c}
              </h5>
            ),
            h6: ({ children: c, ...props }) => (
              <h6
                {...props}
                className={cn(
                  headingFont,
                  "mt-4 mb-1 text-xs uppercase tracking-wide text-muted-foreground",
                )}
              >
                {c}
              </h6>
            ),
            p: ({ children: c, ...props }) => (
              <p {...props} className="my-3">
                {c}
              </p>
            ),
            a: ({ children: c, href, ...props }) => (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:text-foreground/70"
              >
                {c}
              </a>
            ),
            ul: ({ children: c, ...props }) => (
              <ul {...props} className="my-3 list-disc space-y-1.5 pl-6">
                {c}
              </ul>
            ),
            ol: ({ children: c, ...props }) => (
              <ol {...props} className="my-3 list-decimal space-y-1.5 pl-6">
                {c}
              </ol>
            ),
            li: ({ children: c, ...props }) => (
              <li {...props} className="leading-relaxed">
                {c}
              </li>
            ),
            blockquote: ({ children: c, ...props }) => (
              <blockquote
                {...props}
                className="my-4 border-l-2 border-border bg-muted/40 px-4 py-2 italic text-muted-foreground"
              >
                {c}
              </blockquote>
            ),
            hr: (props) => (
              <hr {...props} className="my-6 border-border" />
            ),
            // Render fenced code blocks as a styled <pre>; inline code stays
            // visually lightweight.
            code: ({ className: codeClassName, children: c, ...props }) => {
              const isInline = !codeClassName?.startsWith("language-");
              if (isInline) {
                return (
                  <code
                    {...props}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
                  >
                    {c}
                  </code>
                );
              }
              return (
                <code
                  {...props}
                  className={cn("font-mono text-sm", codeClassName)}
                >
                  {c}
                </code>
              );
            },
            pre: ({ children: c, ...props }) => (
              <pre
                {...props}
                className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-sm"
              >
                {c}
              </pre>
            ),
            table: ({ children: c, ...props }) => (
              <div className="my-4 overflow-x-auto">
                <table
                  {...props}
                  className="w-full border-collapse text-sm"
                >
                  {c}
                </table>
              </div>
            ),
            thead: ({ children: c, ...props }) => (
              <thead {...props} className="border-b border-border bg-muted/40">
                {c}
              </thead>
            ),
            tr: ({ children: c, ...props }) => (
              <tr {...props} className="border-b border-border last:border-0">
                {c}
              </tr>
            ),
            th: ({ children: c, ...props }) => (
              <th
                {...props}
                className="px-3 py-2 text-left font-semibold"
              >
                {c}
              </th>
            ),
            td: ({ children: c, ...props }) => (
              <td {...props} className="px-3 py-2 align-top">
                {c}
              </td>
            ),
            strong: ({ children: c, ...props }) => (
              <strong {...props} className="font-semibold text-foreground">
                {c}
              </strong>
            ),
            em: ({ children: c, ...props }) => (
              <em {...props} className="italic">
                {c}
              </em>
            ),
            // Underline lives behind `allowInlineHtml`; rehype-raw passes the
            // raw <u> through so this component runs.
            u: ({ children: c, ...props }) => (
              <u
                {...props}
                className="underline decoration-foreground/40 underline-offset-4"
              >
                {c}
              </u>
            ),
            ...(componentsOverride ?? {}),
          } satisfies Components
        }
        // Skip every other raw HTML node — only the explicit allowlist above
        // gets through when allowInlineHtml is on.
        skipHtml={!allowInlineHtml}
        allowedElements={undefined}
        unwrapDisallowed={true}
        allowElement={(element) => {
          if (!allowInlineHtml) return true;
          const tag = element?.tagName;
          if (typeof tag !== "string") return true;
          // Block raw HTML elements that aren't on the allowlist while still
          // letting all the markdown-derived nodes through (those are
          // handled by react-markdown directly, not via rehype-raw).
          if (element.type === "element" && /^[a-z][a-z0-9]*$/i.test(tag)) {
            // Markdown-mapped tags we handle via the components map above.
            const ours = new Set([
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "p",
              "a",
              "ul",
              "ol",
              "li",
              "blockquote",
              "hr",
              "code",
              "pre",
              "table",
              "thead",
              "tbody",
              "tr",
              "th",
              "td",
              "strong",
              "em",
            ]);
            if (ours.has(tag)) return true;
            return ALLOWED_RAW_TAGS.has(tag);
          }
          return true;
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
