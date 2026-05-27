import "server-only";

import { TRPCError } from "@trpc/server";

import { extractArticle, safeHostname } from "./readability";

// Domains we refuse to ingest as curriculum / resource sources. Social media
// platforms are blocked because (a) their content is rarely educational and
// (b) their HTML is JS-heavy and rarely extracts cleanly — paying for an AI
// call against a stripped-down "JavaScript is required" page just wastes
// tokens. We match against the registrable suffix (last two segments) so a
// CDN subdomain like `m.youtube.com` still gets blocked.
export const BLOCKED_DOMAINS: ReadonlyArray<string> = [
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "pinterest.ca",
  "pinterest.co.uk",
  "pinterest.fr",
  "pinterest.de",
  "pinterest.es",
  "pinterest.com.au",
  "pinterest.com.mx",
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.com",
  "fb.watch",
  "twitter.com",
  "x.com",
];

// True when `hostname` matches one of the blocked domains exactly or as a
// subdomain (e.g. `www.youtube.com`, `m.youtube.com`). Case-insensitive;
// the leading `www.` is stripped to keep the comparison stable.
export function isBlockedDomain(hostname: string): boolean {
  const cleaned = hostname.trim().toLowerCase().replace(/^www\./, "");
  if (!cleaned) return false;
  return BLOCKED_DOMAINS.some(
    (blocked) => cleaned === blocked || cleaned.endsWith(`.${blocked}`),
  );
}

// Validate the URL the user submitted as a curriculum source. Throws a
// TRPCError so the tRPC layer can surface a clean message to the user and
// the modal can render it as a toast. Splits URL parsing from blocklist
// matching so callers can pass either a parsed URL or a raw string.
export function assertAllowedSourceUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That doesn't look like a valid URL.",
    });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only http(s) URLs can be used as curriculum sources.",
    });
  }
  if (isBlockedDomain(parsed.hostname)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Social-media URLs (YouTube, Pinterest, Instagram, TikTok, Facebook, Twitter/X) can't be used as curriculum sources. Submit a link to a course catalog, syllabus, journal article, dissertation, or academic resource instead.",
    });
  }
}

// What `extractSourceContent` returns on success. Mirrors the subset of
// `ExtractedArticle` that downstream callers (resource create + continuity
// curriculum prompt) actually use, kept narrow so we can switch extractors
// later without touching every consumer.
export type ExtractedSource = {
  title: string;
  markdown: string;
  domain: string | null;
  wordCount: number;
};

// Synchronously fetch the URL and run reader-mode extraction. On any
// failure (network, paywall, JS-only page, empty article body) this throws
// a TRPCError so the curriculum-create flow can hard-reject *before* any
// AI tokens are spent on a half-extracted source.
//
// Callers that want to keep going on extraction failure (the legacy
// `createResourceLink` path that defers extraction to first view) should
// catch and ignore the error themselves rather than calling this helper.
export async function extractSourceContent(
  url: string,
): Promise<ExtractedSource> {
  assertAllowedSourceUrl(url);
  let article;
  try {
    article = await extractArticle(url);
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Failed to fetch this URL.";
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Couldn't extract content from this link: ${message}`,
    });
  }
  const markdown = article.markdown.trim();
  if (!markdown) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "We fetched this URL but couldn't extract any readable content. Try a direct link to the article or syllabus PDF.",
    });
  }
  return {
    title: article.title,
    markdown,
    domain: safeHostname(url),
    wordCount: article.wordCount,
  };
}
