"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  FileIcon,
  FileTextIcon,
  GlobeIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@quazom-ai/ui/components/ui/tabs";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@quazom-ai/ui/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@quazom-ai/ui/components/ui/alert-dialog";
import { useTRPC } from "@/trpc/client";
import type {
  ResourceFileType,
  ResourceKind,
  ResourceStatus,
} from "@/inngest/schemas";
import { AnnotatedMarkdown } from "../notes/annotated-markdown";
import { Highlightable } from "../lesson/highlightable";
import { SpeakTextButton } from "@/components/shared/speak-text-button";
import { ResourceNotesPanel } from "./resource-notes-panel";

export type ResourceViewData = {
  id: string;
  kind: ResourceKind;
  title: string;
  description: string | null;
  url: string | null;
  domain: string | null;
  fileType: ResourceFileType | null;
  fileSize: number | null;
  fileName: string | null;
  fileMimeType: string | null;
  status: ResourceStatus;
  statusMessage: string | null;
  content: string | null;
  extractedAt: string | Date | null;
  signedFileUrl: string | null;
  curricula: { id: string; title: string }[];
  lessons: { id: string; title: string; curriculumId: string }[];
};

type Props = {
  initial: ResourceViewData;
};

type ViewMode = "reader" | "iframe";

export function ResourceViewer({ initial }: Props) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Re-fetch on the client so we can:
  //  1. Refresh signed file URLs (server-issued ones expire after ~10 min).
  //  2. Pick up status changes from background extraction without a page reload.
  const detailQuery = useQuery(
    trpc.getResource.queryOptions(
      { id: initial.id },
      {
        refetchInterval: (q) =>
          q.state.data?.status === "PENDING" ? 4_000 : false,
      },
    ),
  );
  // The tRPC response uses `Date` for timestamps; our view-model accepts
  // either since the server component hydrates with Date values too. Cast
  // through `unknown` so the optional chaining stays type-safe.
  const data: ResourceViewData = (detailQuery.data as
    | ResourceViewData
    | undefined) ?? initial;

  const annotationsQuery = useQuery(
    trpc.listAnnotations.queryOptions({ resourceId: data.id }),
  );
  const annotations = annotationsQuery.data ?? [];

  const isLink = data.kind === "LINK";
  const isMarkdownish =
    data.fileType === "MD" || data.fileType === "TXT";
  const isPdf = data.fileType === "PDF";
  const isFile = data.kind === "FILE";
  // Reader mode is the "extracted-text-rendered-as-markdown" view that
  // powers highlights + annotations. It's available wherever we can
  // produce a text body:
  //   - LINK: after the URL is fetched + run through Readability
  //           (auto-triggered on first viewer open below).
  //   - TXT / MD: immediately — the body is cached on Resource.content
  //               during confirmResourceUpload.
  //   - PDF: after pdf.js extracts a per-page text body during upload
  //          confirmation (auto-retried on first viewer open if the
  //          confirm-time extraction failed or the file pre-dates the
  //          PDF extractor). Image-only PDFs stay empty until OCR.
  const supportsReader = isLink || isMarkdownish || isPdf;
  const hasReaderContent = Boolean(data.content && data.content.trim().length);
  // FILE resources are streamed through our own /api proxy route — that's
  // far more reliable as an iframe source than the raw R2 signed URL, which
  // Chrome's PDF viewer routinely refuses to render. The server-side query
  // still mints `signedFileUrl` for explicit downloads / fallbacks.
  const fileProxyUrl =
    !isLink && data.kind === "FILE" && data.status === "READY"
      ? `/api/resources/${data.id}/file`
      : null;
  const hasIframe = isLink ? Boolean(data.url) : Boolean(fileProxyUrl);

  const [mode, setMode] = useState<ViewMode>(
    supportsReader ? "reader" : "iframe",
  );
  useEffect(() => {
    if (mode === "reader" && !supportsReader && hasIframe) setMode("iframe");
    if (mode === "iframe" && !hasIframe && supportsReader) setMode("reader");
  }, [hasIframe, supportsReader, mode]);

  // Tracks whether the *current* extraction attempt was kicked off by the
  // user vs. our auto-extract effect. Auto-runs stay quiet; explicit
  // clicks get a success toast so the user gets confirmation.
  const userInitiatedExtract = useRef(false);
  const extractLink = useMutation(
    trpc.extractResourceLink.mutationOptions({
      onSuccess: () => {
        if (userInitiatedExtract.current) toast.success("Reader view ready");
        userInitiatedExtract.current = false;
        void queryClient.invalidateQueries({
          queryKey: trpc.getResource.pathKey(),
        });
      },
      onError: (e) => {
        // Auto-extract failures shouldn't fire a toast — the reader-tab
        // body already shows the error with a retry button.
        if (userInitiatedExtract.current) {
          toast.error(e.message ?? "Couldn't fetch reader view");
        }
        userInitiatedExtract.current = false;
      },
    }),
  );
  const extractFile = useMutation(
    trpc.extractResourceFile.mutationOptions({
      onSuccess: () => {
        if (userInitiatedExtract.current) toast.success("Reader view ready");
        userInitiatedExtract.current = false;
        void queryClient.invalidateQueries({
          queryKey: trpc.getResource.pathKey(),
        });
      },
      onError: (e) => {
        if (userInitiatedExtract.current) {
          toast.error(e.message ?? "Couldn't extract this file");
        }
        userInitiatedExtract.current = false;
      },
    }),
  );

  // Pick the right extractor for this resource. LINK runs Readability
  // against the URL; FILE re-reads R2 + (for PDF) runs pdf.js.
  const extract = isLink ? extractLink : extractFile;

  // Auto-trigger extraction whenever a resource that supports reader mode
  // arrives with no cached content. Originally only fired for LINKs (per
  // the `createResourceLink` "lazy on first open" comment that was never
  // implemented); now also covers PDFs uploaded before the PDF extractor
  // existed and any TXT/MD/PDF whose confirm-time extraction failed.
  // Guarded by a ref so it only fires once per resource id even across
  // re-renders, and gated by `statusMessage` so an image-only PDF doesn't
  // keep getting re-parsed on every viewer open just to yield no text
  // again — those cases need a deliberate user click on Re-extract.
  const autoExtractedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!supportsReader) return;
    if (data.status !== "READY") return;
    if (hasReaderContent) return;
    if (extract.isPending) return;
    if (data.statusMessage) return;
    if (autoExtractedFor.current === data.id) return;
    autoExtractedFor.current = data.id;
    extract.mutate({ id: data.id });
  }, [
    supportsReader,
    data.status,
    data.id,
    hasReaderContent,
    data.statusMessage,
    extract,
  ]);

  const requestExtract = (force = false) => {
    userInitiatedExtract.current = true;
    extract.mutate({ id: data.id, force });
  };

  const remove = useMutation(
    trpc.deleteResource.mutationOptions({
      onSuccess: () => {
        toast.success("Resource deleted");
        router.replace("/resources");
      },
      onError: (e) => toast.error(e.message ?? "Failed to delete resource"),
    }),
  );

  const [deleteOpen, setDeleteOpen] = useState(false);

  const Icon = isLink ? GlobeIcon : isPdf ? FileIcon : FileTextIcon;
  const subtitle = isLink
    ? data.domain ?? hostname(data.url) ?? "Saved link"
    : `${data.fileType ?? "FILE"} · ${formatBytes(data.fileSize)}`;

  const iframeSrc = isLink ? data.url : fileProxyUrl;

  return (
    <div className="flex min-w-0 flex-col">
      <header className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:py-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/resources"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              All resources
            </Link>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                    {data.title || "Untitled resource"}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                </div>
              </div>
              {data.description ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {data.description}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">
                  {isLink ? "Link" : data.fileType}
                </Badge>
                {data.curricula.map((c) => (
                  <Badge key={c.id} variant="secondary" asChild>
                    <Link href={`/curriculum/${c.id}`}>{c.title}</Link>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 self-start">
              {isLink && data.url ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                >
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLinkIcon className="size-4" />
                    Open original
                  </a>
                </Button>
              ) : null}
              {supportsReader ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={extract.isPending}
                      onClick={() => requestExtract(true)}
                    >
                      {extract.isPending ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="size-4" />
                      )}
                      <span className="hidden sm:inline">Re-extract</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isLink
                      ? "Regenerate the reader-mode text from this URL."
                      : isPdf
                        ? "Re-run PDF text extraction for reader mode."
                        : "Re-read the file body and refresh reader mode."}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="size-4" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>
          {data.status === "PENDING" ? (
            <p className="inline-flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Loader2Icon className="size-3 animate-spin" />
              {data.statusMessage ?? "Processing…"}
            </p>
          ) : null}
          {data.status === "FAILED" ? (
            <p className="text-xs text-destructive">
              {data.statusMessage ??
                "Something went wrong with this resource. Try re-uploading or re-extracting."}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 py-6 md:py-8">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as ViewMode)}
          className="flex flex-col gap-4"
        >
          <TabsList className="self-start">
            <TabsTrigger value="reader" disabled={!supportsReader}>
              Reader mode
            </TabsTrigger>
            <TabsTrigger value="iframe" disabled={!hasIframe}>
              {isLink ? "Embed" : "Raw file"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reader" className="min-w-0">
            {hasReaderContent ? (
              <Highlightable target={{ kind: "resource", resourceId: data.id }}>
                <article className="flex max-w-none flex-col gap-3">
                  <SpeakTextButton
                    text={data.content ?? ""}
                    label="Speak text"
                    className="self-start"
                  />
                  <AnnotatedMarkdown annotations={annotations}>
                    {data.content ?? ""}
                  </AnnotatedMarkdown>
                </article>
              </Highlightable>
            ) : (
              <ReaderEmptyState
                isLink={isLink}
                isPdf={isPdf}
                isMarkdownish={isMarkdownish}
                isFile={isFile}
                pending={extract.isPending}
                statusMessage={data.statusMessage}
                error={extract.error?.message ?? null}
                onRetry={() => requestExtract(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="iframe" className="min-w-0">
            {iframeSrc ? (
              <ResourceEmbed
                src={iframeSrc}
                isPdf={isPdf}
                isLink={isLink}
                title={data.title}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No embeddable version is available yet.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <ResourceNotesPanel resourceId={data.id} />
        </div>
      </section>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
            <AlertDialogDescription>
              The file or saved link will be removed from your collection along
              with its highlights. Notes attached to it stay in your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: data.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Rendered inside the Reader tab whenever `Resource.content` is missing —
 * picks the appropriate copy + affordance for each case:
 *   - Currently extracting (any kind): spinner + status copy.
 *   - PDF that returned no text (image-only / OCR not supported yet):
 *     surfaces the status message from the server.
 *   - LINK / FILE that errored: surfaces the error with a retry button.
 *   - LINK that has never been extracted: explicit "Fetch reader view"
 *     button (auto-extract should normally do this transparently).
 *   - TXT / MD without cached body: prompts the user to re-extract from
 *     the header button (transient R2 read failure during upload).
 */
function ReaderEmptyState({
  isLink,
  isPdf,
  isMarkdownish,
  isFile,
  pending,
  statusMessage,
  error,
  onRetry,
}: {
  isLink: boolean;
  isPdf: boolean;
  isMarkdownish: boolean;
  isFile: boolean;
  pending: boolean;
  statusMessage: string | null;
  error: string | null;
  onRetry: () => void;
}) {
  const box =
    "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center";

  if (pending) {
    const label = isLink
      ? "Extracting article…"
      : isPdf
        ? "Extracting text from this PDF…"
        : "Reading file body…";
    return (
      <div className={box}>
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {label} this usually takes a few seconds.
        </p>
      </div>
    );
  }

  // `statusMessage` is the server's last word on why extraction didn't
  // produce content — we trust it for both the "image-only PDF" case and
  // the "transient R2 read failure" case. Surface it verbatim so the user
  // sees the same wording the API decided on.
  if (isPdf && statusMessage) {
    return (
      <div className={box}>
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className={box}>
        <p className="text-sm text-destructive">
          Couldn't extract this {isLink ? "article" : "file"}: {error}
        </p>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (isLink) {
    return (
      <div className={box}>
        <p className="text-sm text-muted-foreground">
          Reader mode hasn't been generated yet. Pull a clean copy of this page
          so you can highlight and quote it.
        </p>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          onClick={onRetry}
        >
          Fetch reader view
        </Button>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className={box}>
        <p className="text-sm text-muted-foreground">
          Reader mode hasn't been generated yet. Extract the text from this PDF
          so you can highlight and quote passages.
        </p>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          onClick={onRetry}
        >
          Extract PDF text
        </Button>
      </div>
    );
  }

  if (isMarkdownish || isFile) {
    return (
      <div className={box}>
        <p className="text-sm text-muted-foreground">
          We couldn't read the text body of this file when it was uploaded.
        </p>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          onClick={onRetry}
        >
          Re-extract
        </Button>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Reader mode isn't available for this resource.
    </p>
  );
}

function ResourceEmbed({
  src,
  isPdf,
  isLink,
  title,
}: {
  src: string;
  isPdf: boolean;
  isLink: boolean;
  title: string;
}) {
  // Many publishers send X-Frame-Options: DENY which silently blanks the
  // iframe. We can't detect that from the client, so we surface a "doesn't
  // load? open in a new tab" affordance directly above the frame.
  return (
    <div className="flex flex-col gap-2">
      {isLink ? (
        <p className="text-xs text-muted-foreground">
          Some sites block being embedded. If the frame stays blank, use{" "}
          <span className="font-medium">Open original</span> in the header.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
        <iframe
          // Force a fresh iframe element whenever the URL changes so React
          // never tries to navigate an already-errored frame (Chrome blocks
          // that with a same-origin policy error once the previous load has
          // dropped the frame onto `chrome-error://chromewebdata/`).
          key={src}
          src={src}
          title={title}
          // PDFs are streamed through our own /api proxy, so the iframe is
          // same-origin and we own the bytes — sandboxing adds no security
          // here AND actively breaks rendering: Chrome's built-in PDF
          // viewer needs to navigate the frame to a `chrome-extension://…`
          // document, and a sandbox attribute blocks that handoff with
          // "This page has been blocked by Chrome". For arbitrary saved
          // links we still sandbox because the content is untrusted.
          {...(isPdf
            ? {}
            : { sandbox: "allow-scripts allow-popups allow-forms" })}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="block h-[78vh] w-full"
        />
      </div>
    </div>
  );
}

function hostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
