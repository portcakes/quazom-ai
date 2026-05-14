import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

// Cap how much text we'll pull out of a PDF. Resource.content is already
// capped at 200_000 chars elsewhere — this is the same ceiling so we don't
// load the entire string into memory just to slice it.
const MAX_PDF_TEXT_LENGTH = 200_000;

export type PdfExtraction = {
  /** Reader-mode markdown synthesised from the page-by-page text. */
  markdown: string;
  /** Total page count reported by pdf.js. */
  pageCount: number;
  /** True when the PDF parsed but had effectively no extractable text
   *  (most often a scanned-image PDF). */
  isImageOnly: boolean;
};

/**
 * Pull readable text out of a PDF buffer and emit it as lightweight markdown
 * so the existing reader-mode pipeline (AnnotatedMarkdown + Highlightable)
 * can render and annotate it the same way it handles LINK / TXT / MD.
 *
 * Why markdown and not plain text:
 *   - The viewer's reader tab pipes content through `react-markdown`. Plain
 *     paragraphs render as one giant blob with no whitespace.
 *   - Inserting a `## Page N` heading between pages preserves the document's
 *     structure enough that "highlight a quote on page 3" stays meaningful.
 *
 * Throws on parse failures so the caller can surface a useful error.
 */
export async function extractPdfText(
  data: ArrayBuffer | Uint8Array,
): Promise<PdfExtraction> {
  // unpdf accepts ArrayBuffer / Uint8Array directly. Normalise to a fresh
  // Uint8Array view so a stray subarray doesn't corrupt the parse.
  const bytes =
    data instanceof Uint8Array ? data : new Uint8Array(data);

  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  const pages = Array.isArray(text) ? text : [text];
  const cleaned = pages.map((page) => normalisePageText(page ?? ""));
  const nonEmpty = cleaned.filter((p) => p.trim().length > 0);

  if (nonEmpty.length === 0) {
    return {
      markdown: "",
      pageCount: totalPages,
      isImageOnly: true,
    };
  }

  // Synthesise "## Page N" between pages so the markdown renderer (and
  // any future page-aware highlighter) can keep their positions straight.
  let out = "";
  for (let i = 0; i < cleaned.length; i++) {
    const body = cleaned[i]!.trim();
    if (!body) continue;
    if (out.length > 0) out += "\n\n";
    out += `## Page ${i + 1}\n\n${body}`;
    if (out.length >= MAX_PDF_TEXT_LENGTH) break;
  }

  return {
    markdown: out.slice(0, MAX_PDF_TEXT_LENGTH),
    pageCount: totalPages,
    isImageOnly: false,
  };
}

/**
 * Heuristic clean-up of a single page's extracted text. pdf.js returns text
 * items in reading order but without paragraph structure, so we:
 *   1. Collapse runs of spaces/tabs into a single space.
 *   2. Re-flow soft-broken lines (hyphenated word continuations and
 *      single-newline-mid-sentence wraps) back together.
 *   3. Promote double-newlines into real paragraph breaks.
 */
function normalisePageText(input: string): string {
  let s = input.replace(/\r\n/g, "\n");
  // De-hyphenate words that span a line break: "Inter-\nnational" → "International".
  s = s.replace(/([A-Za-z])-\n([A-Za-z])/g, "$1$2");
  // Collapse single newlines inside paragraphs into spaces, but preserve
  // double newlines as paragraph separators.
  s = s.replace(/([^\n])\n(?!\n)/g, "$1 ");
  // Collapse runs of horizontal whitespace.
  s = s.replace(/[\t ]+/g, " ");
  // Normalise paragraph breaks.
  s = s.replace(/\n{2,}/g, "\n\n");
  return s.trim();
}
