"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@quazom-ai/ui/lib/utils";

type Props = {
  children: string;
  className?: string;
  /** Smaller scale for tight contexts (overviews, hover cards, etc.). */
  compact?: boolean;
};

/**
 * Renders markdown using design-system tokens instead of @tailwindcss/typography.
 * Heading scale matches our `font-heading` aesthetic and stays consistent with
 * the rest of the lesson chrome.
 *
 * Treats markdown as untrusted content: we don't enable raw HTML so a
 * model-emitted `<script>` can't sneak through.
 */
export function Markdown({ children, className, compact = false }: Props) {
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
          } satisfies Components
        }
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
