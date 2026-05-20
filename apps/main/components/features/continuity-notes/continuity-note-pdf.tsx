"use client";

/**
 * Opens a hidden printable view of a Continuity Note and triggers the
 * browser's print dialog, which the user can route to "Save as PDF". Keeping
 * the conversion in-browser avoids dragging a heavyweight PDF library
 * (jspdf/html2canvas/etc.) into the bundle just for an occasional export,
 * and the resulting PDF preserves the editor's HTML — including badges,
 * highlight colours, and embedded links — at full fidelity.
 *
 * We render into a freshly minted same-origin iframe rather than a popup
 * window so adblockers / popup blockers don't intervene, and so the print
 * styles stay isolated from the host page's CSS.
 */
export function downloadContinuityNoteAsPdf({
  title,
  html,
}: {
  title: string;
  html: string;
}) {
  if (typeof window === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Continuity Note print frame");
  document.body.appendChild(iframe);

  const cleanup = () => {
    // Delay slightly so the print dialog finishes reading the document.
    setTimeout(() => {
      iframe.parentNode?.removeChild(iframe);
    }, 1000);
  };

  // Strip any user-provided <script>/<style> just in case — the rich-text
  // editor never produces these but we treat the HTML as untrusted on the
  // output side too.
  const safeBody = sanitizeForPrint(html);
  const safeTitle = escapeHtml(title);
  const doc = iframe.contentDocument;
  if (!doc) {
    cleanup();
    return;
  }
  doc.open();
  doc.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>${PRINT_CSS}</style>
  </head>
  <body>
    <main class="cn-print">
      <h1 class="cn-print__title">${safeTitle}</h1>
      <div class="cn-print__body">${safeBody}</div>
    </main>
  </body>
</html>`);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  };

  // Give the iframe a tick to lay out before we ask the browser to print —
  // otherwise long notes occasionally print with the heading clipped.
  if (iframe.contentDocument?.readyState === "complete") {
    triggerPrint();
  } else {
    iframe.addEventListener("load", triggerPrint, { once: true });
    // Fallback in case the load event never fires (some browsers don't fire
    // it for document.write iframes).
    setTimeout(triggerPrint, 250);
  }
}

// Editor-mirroring CSS for the printable view. The rules are deliberately
// independent of the live app's CSS variables so the printed output looks
// consistent regardless of the user's theme.
const PRINT_CSS = `
  :root { color-scheme: light; }
  html, body { background: #ffffff; color: #1f1d1b; }
  body {
    font-family: 'Libre Baskerville', Georgia, serif;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }
  .cn-print {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 56px;
  }
  .cn-print__title {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 24px;
    line-height: 1.2;
  }
  .cn-print__body p { margin: 0 0 12px; }
  .cn-print__body h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px; }
  .cn-print__body h2 { font-size: 22px; font-weight: 700; margin: 20px 0 10px; }
  .cn-print__body h3 { font-size: 18px; font-weight: 600; margin: 18px 0 8px; }
  .cn-print__body ul, .cn-print__body ol { padding-left: 24px; margin: 12px 0; }
  .cn-print__body li { margin: 4px 0; }
  .cn-print__body blockquote {
    border-left: 4px solid #d6d3cf;
    padding-left: 12px;
    color: #5d5856;
    font-style: italic;
    margin: 16px 0;
  }
  .cn-print__body code {
    font-family: 'IBM Plex Mono', Menlo, monospace;
    background: #f5f1ec;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 90%;
  }
  .cn-print__body pre {
    background: #f5f1ec;
    padding: 12px 14px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 16px 0;
  }
  .cn-print__body pre code { background: transparent; padding: 0; }
  .cn-print__body hr {
    border: 0;
    border-top: 1px solid #d6d3cf;
    margin: 24px 0;
  }
  .cn-print__body a { color: #6b4f2c; text-decoration: underline; }
  .cn-print__body a[data-source-badge="true"] {
    display: inline-block;
    padding: 1px 8px;
    border: 1px solid #d6d3cf;
    border-radius: 999px;
    background: #f5f1ec;
    color: #1f1d1b;
    text-decoration: none;
    font-weight: 600;
    font-size: 90%;
  }
  .cn-print__body mark {
    padding: 0 2px;
    border-radius: 2px;
  }
  @page {
    margin: 24mm 18mm;
  }
`;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeForPrint(html: string): string {
  // Strip <script> tags and inline event handlers. The editor never emits
  // these, but we treat the body as untrusted on the way out too. We keep
  // <style> stripping out so an embedded <style> can't override our print
  // CSS.
  return html
    .replace(/<\/?(script|style)[^>]*>/gi, "")
    .replace(/on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/on[a-z]+\s*=\s*'[^']*'/gi, "");
}
