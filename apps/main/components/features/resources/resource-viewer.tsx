"use client";

import { useEffect, useState } from "react";
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
  const hasReader = isLink ? Boolean(data.content) : isMarkdownish;
  // FILE resources are streamed through our own /api proxy route — that's
  // far more reliable as an iframe source than the raw R2 signed URL, which
  // Chrome's PDF viewer routinely refuses to render. The server-side query
  // still mints `signedFileUrl` for explicit downloads / fallbacks.
  const fileProxyUrl =
    !isLink && data.kind === "FILE" && data.status === "READY"
      ? `/api/resources/${data.id}/file`
      : null;
  const hasIframe = isLink ? Boolean(data.url) : Boolean(fileProxyUrl);

  const [mode, setMode] = useState<ViewMode>(hasReader ? "reader" : "iframe");
  useEffect(() => {
    if (mode === "reader" && !hasReader && hasIframe) setMode("iframe");
    if (mode === "iframe" && !hasIframe && hasReader) setMode("reader");
  }, [hasIframe, hasReader, mode]);

  const extract = useMutation(
    trpc.extractResourceLink.mutationOptions({
      onSuccess: () => {
        toast.success("Reader view ready");
        void queryClient.invalidateQueries({
          queryKey: trpc.getResource.pathKey(),
        });
      },
      onError: (e) => toast.error(e.message ?? "Couldn't fetch reader view"),
    }),
  );

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
              {isLink ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={extract.isPending}
                      onClick={() => extract.mutate({ id: data.id })}
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
                    Regenerate the reader-mode text from this URL.
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
            <TabsTrigger value="reader" disabled={!hasReader}>
              Reader mode
            </TabsTrigger>
            <TabsTrigger value="iframe" disabled={!hasIframe}>
              {isLink ? "Embed" : "Raw file"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reader" className="min-w-0">
            {hasReader ? (
              <Highlightable target={{ kind: "resource", resourceId: data.id }}>
                <article className="max-w-none">
                  <AnnotatedMarkdown annotations={annotations}>
                    {data.content ?? ""}
                  </AnnotatedMarkdown>
                </article>
              </Highlightable>
            ) : isLink ? (
              <NoReaderEmpty
                onExtract={() => extract.mutate({ id: data.id })}
                pending={extract.isPending}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Reader mode isn't available for this file type.
              </p>
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

function NoReaderEmpty({
  onExtract,
  pending,
}: {
  onExtract: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Reader mode hasn't been generated yet. Pull a clean copy of this page
        so you can highlight and quote it.
      </p>
      <Button
        type="button"
        size="sm"
        className="cursor-pointer"
        onClick={onExtract}
        disabled={pending}
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        Fetch reader view
      </Button>
    </div>
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
          // Sandbox keeps third-party scripts from poking at our auth cookies.
          // We grant just enough capability for PDF viewers (scripts) and
          // basic article navigation (popups → new tab on link click).
          sandbox={
            isPdf
              ? "allow-scripts allow-same-origin"
              : "allow-scripts allow-popups allow-forms"
          }
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
