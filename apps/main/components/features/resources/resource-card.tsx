"use client";

import Link from "next/link";
import {
  ExternalLinkIcon,
  FileTextIcon,
  FileIcon,
  GlobeIcon,
  Loader2Icon,
} from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { cn } from "@quazom-ai/ui/lib/utils";

export type ResourceCardData = {
  id: string;
  kind: "LINK" | "FILE";
  title: string;
  description: string | null;
  url: string | null;
  domain: string | null;
  fileKey: string | null;
  fileType: "TXT" | "PDF" | "MD" | null;
  fileSize: number | null;
  fileName: string | null;
  status: "PENDING" | "READY" | "FAILED";
  statusMessage: string | null;
  createdAt: Date | string;
  curriculumIds?: string[];
  lessonIds?: string[];
};

type Props = {
  resource: ResourceCardData;
  /** When true the card spans full width (single-column listing). */
  singleColumn?: boolean;
};

/**
 * Resource tile rendered on /resources, the curriculum Resources tab, and
 * any "My resources" panel. Click anywhere to open the dedicated viewer.
 */
export function ResourceCard({ resource, singleColumn }: Props) {
  const isLink = resource.kind === "LINK";
  const Icon = pickIcon(resource);
  const subtitle = isLink
    ? resource.domain ?? hostname(resource.url) ?? "Saved link"
    : `${resource.fileType ?? "FILE"} · ${formatBytes(resource.fileSize)}`;

  const ringClass =
    "group flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-sidebar-accent/40 hover:ring-1 hover:ring-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Link
      href={`/resources/${resource.id}`}
      className={cn(
        ringClass,
        singleColumn ? "flex-row items-stretch" : "aspect-[3/2] min-w-0",
      )}
      aria-label={`Open resource ${resource.title}`}
    >
      <div className={cn("flex items-start gap-3", singleColumn ? "" : "min-w-0") }>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="min-w-0 truncate font-heading text-sm font-semibold leading-snug">
              {resource.title || "Untitled resource"}
            </h3>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {isLink ? "Link" : resource.fileType}
            </Badge>
          </div>
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
          {resource.description ? (
            <p
              className={cn(
                "whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground",
                singleColumn ? "line-clamp-1" : "line-clamp-3",
              )}
            >
              {resource.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <StatusBadge status={resource.status} />
        {isLink && resource.url ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3" />
            <span className="truncate">Open</span>
          </a>
        ) : null}
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: ResourceCardData["status"] }) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Loader2Icon className="size-3 animate-spin" />
        Uploading
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        Upload failed
      </span>
    );
  }
  return null;
}

function pickIcon(resource: ResourceCardData) {
  if (resource.kind === "LINK") return GlobeIcon;
  if (resource.fileType === "PDF") return FileIcon;
  return FileTextIcon;
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
