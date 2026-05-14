import "server-only";

import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// Cap how much HTML we'll bother parsing. Most articles are well under a
// megabyte; capping protects us from a hostile site returning gigabytes of
// markup that would tie up the lambda.
const MAX_HTML_BYTES = 4 * 1024 * 1024; // 4 MB
const FETCH_TIMEOUT_MS = 12_000;

export type ExtractedArticle = {
  /** Title surfaced by readability; falls back to the URL if missing. */
  title: string;
  /** Author/byline if readability was able to infer one. */
  byline: string | null;
  /** Excerpt / lede readability uses for previews. */
  excerpt: string | null;
  /** Hostname of the source URL (e.g. "en.wikipedia.org"). */
  siteName: string | null;
  /** Whole article rendered as markdown so we can pipe it through the
   *  existing AnnotatedMarkdown component. */
  markdown: string;
  /** Approximate word count for "X minute read" UI. */
  wordCount: number;
};

/**
 * Fetch the URL, run Mozilla Readability over the resulting DOM, and turn
 * the simplified article body into markdown so we can render + annotate it
 * with the same component pipeline used elsewhere in the app.
 *
 * Throws on network / parse failures; callers should catch and surface a
 * "we couldn't extract this article" message in the UI so the user can fall
 * back to the raw iframe view.
 */
export async function extractArticle(url: string): Promise<ExtractedArticle> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const res = await fetch(url, {
      // Pretend to be a desktop browser. Some sites return a stripped
      // mobile view (or an interstitial) to obvious bots, which makes
      // Readability dredge up the wrong content.
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(
        `Source returned ${res.status} ${res.statusText} when fetching ${url}`,
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new Error(
        `Source content-type is "${contentType}" — only HTML pages can be extracted.`,
      );
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      throw new Error(
        `Source HTML is too large (${buf.byteLength.toLocaleString()} bytes); skipping extraction.`,
      );
    }
    html = new TextDecoder("utf-8").decode(buf);
  } finally {
    clearTimeout(timer);
  }

  // linkedom gives us a DOMParser-ish API without the weight of jsdom,
  // which is what Mozilla Readability needs to walk the tree.
  const { document } = parseHTML(html);
  // Readability mutates the tree, so we clone the doc lazily by way of
  // serializing the body before parse. In practice we don't need the
  // original, so we let it consume the working copy.
  const reader = new Readability(document as unknown as Document);
  const parsed = reader.parse();
  if (!parsed || !parsed.content) {
    throw new Error("Couldn't extract a readable article from this URL.");
  }

  const siteName =
    (parsed.siteName?.trim() || safeHostname(url)) ?? null;
  const title = parsed.title?.trim() || safeHostname(url) || url;
  const byline = parsed.byline?.trim() || null;
  const excerpt = parsed.excerpt?.trim() || null;
  const wordCount = parsed.length ?? approximateWordCount(parsed.textContent);

  // Readability returns sanitised HTML; convert it to markdown so the rest
  // of the app (which already has a robust markdown pipeline) can render
  // it without a separate code path.
  const markdown = htmlToMarkdown(parsed.content);

  return {
    title,
    byline,
    excerpt,
    siteName,
    markdown,
    wordCount,
  };
}

export function safeHostname(input: string): string | null {
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function approximateWordCount(text: string | undefined | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---- HTML → markdown -----------------------------------------------------
//
// We deliberately ship our own miniature converter instead of pulling
// `turndown` in. The Readability output is already heavily sanitised
// (handful of block tags, no JS, no styles), so the surface area we have
// to translate is small and predictable.

function htmlToMarkdown(html: string): string {
  const { document } = parseHTML(`<root>${html}</root>`);
  const root = document.querySelector("root");
  if (!root) return "";
  const out = renderNode(root as unknown as Element).trim();
  // Collapse runs of 3+ blank lines that the recursive emit sometimes
  // produces around nested blocks.
  return out.replace(/\n{3,}/g, "\n\n");
}

type DomNode = {
  nodeType: number;
  nodeName?: string;
  textContent?: string | null;
  childNodes?: ArrayLike<DomNode>;
  getAttribute?: (name: string) => string | null;
};

function renderNode(node: DomNode): string {
  if (!node) return "";
  // Text node
  if (node.nodeType === 3) {
    return collapseInlineWhitespace(node.textContent ?? "");
  }
  if (node.nodeType !== 1) return "";
  const tag = (node.nodeName || "").toLowerCase();
  const children = node.childNodes
    ? Array.from(node.childNodes as ArrayLike<DomNode>).map((c) => renderNode(c)).join("")
    : "";

  switch (tag) {
    case "root":
      return children;
    case "h1":
      return `\n\n# ${children.trim()}\n\n`;
    case "h2":
      return `\n\n## ${children.trim()}\n\n`;
    case "h3":
      return `\n\n### ${children.trim()}\n\n`;
    case "h4":
      return `\n\n#### ${children.trim()}\n\n`;
    case "h5":
      return `\n\n##### ${children.trim()}\n\n`;
    case "h6":
      return `\n\n###### ${children.trim()}\n\n`;
    case "p":
      return `\n\n${children.trim()}\n\n`;
    case "br":
      return "  \n";
    case "hr":
      return "\n\n---\n\n";
    case "blockquote":
      return `\n\n${children
        .split("\n")
        .map((l) => (l.trim() ? `> ${l}` : ">"))
        .join("\n")
        .trim()}\n\n`;
    case "ul":
      return `\n\n${renderList(node, false)}\n\n`;
    case "ol":
      return `\n\n${renderList(node, true)}\n\n`;
    case "li":
      // List items handled inside renderList; if we hit one directly it's
      // because we recursed in from an unexpected parent — treat it as a
      // bullet line so the content isn't dropped.
      return `- ${children.trim()}\n`;
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "code":
      return `\`${children}\``;
    case "pre":
      return `\n\n\`\`\`\n${stripBackticks(children)}\n\`\`\`\n\n`;
    case "a": {
      const href = node.getAttribute?.("href") ?? "";
      if (!href) return children;
      const label = children.trim() || href;
      return `[${label}](${href})`;
    }
    case "img": {
      const src = node.getAttribute?.("src") ?? "";
      const alt = node.getAttribute?.("alt") ?? "";
      if (!src) return "";
      return `![${alt}](${src})`;
    }
    case "figcaption":
      return `\n\n*${children.trim()}*\n\n`;
    case "figure":
    case "section":
    case "article":
    case "div":
    case "span":
    case "main":
    case "aside":
      return children;
    case "table":
      // Markdown tables are picky; collapse to the table's text content so
      // we don't drop the data, even if formatting is lost.
      return `\n\n${(node.textContent ?? "").trim()}\n\n`;
    default:
      return children;
  }
}

function renderList(node: DomNode, ordered: boolean): string {
  const items = node.childNodes
    ? Array.from(node.childNodes as ArrayLike<DomNode>).filter(
        (n) => n.nodeType === 1 && (n.nodeName || "").toLowerCase() === "li",
      )
    : [];
  return items
    .map((li, idx) => {
      const inner = li.childNodes
        ? Array.from(li.childNodes as ArrayLike<DomNode>)
            .map((c) => renderNode(c))
            .join("")
        : "";
      const prefix = ordered ? `${idx + 1}.` : "-";
      // Indent nested-block continuations so they stay inside the list
      // item rather than terminating it early.
      const body = inner
        .trim()
        .split("\n")
        .map((line, i) => (i === 0 ? line : `   ${line}`))
        .join("\n");
      return `${prefix} ${body}`;
    })
    .join("\n");
}

function collapseInlineWhitespace(input: string): string {
  // Don't trim — leading/trailing spaces between inline elements matter for
  // readable output. Just collapse runs of whitespace.
  return input.replace(/[\t ]+/g, " ");
}

function stripBackticks(input: string): string {
  return input.replace(/```/g, "ʼʼʼ");
}
