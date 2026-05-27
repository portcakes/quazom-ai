"use client";

import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import {
  FileTextIcon,
  LinkIcon,
  Loader2Icon,
  TagIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";

// ---------------------------------------------------------------------------
// Shared types for the source picker. Used by the New Curriculum modal AND
// the onboarding "Advanced setup" surface so both flows share one mental
// model for what a "source" is.
// ---------------------------------------------------------------------------

export type LinkSource = {
  kind: "link";
  /** Local-only UUID — separate from `resourceId` so identical resources can
   * be deduped via the latter. */
  id: string;
  resourceId: string;
  title: string;
  url: string;
  domain: string | null;
};
export type FileSource = {
  kind: "file";
  id: string;
  resourceId: string;
  title: string;
  fileType: string;
};
export type TopicSource = {
  kind: "topic";
  id: string;
  text: string;
};

export type Source = LinkSource | FileSource | TopicSource;

// ---------------------------------------------------------------------------
// SourcesEditor — picker for links, file uploads, and free-text topic chips.
// Caller owns the source state. The editor renders the current list with
// remove buttons, plus inline "Add a link" / "Upload file" / "Add a topic"
// panels.
// ---------------------------------------------------------------------------

type SourcesEditorProps = {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
  /** Hard cap on the number of attached sources. The "add" buttons are
   * disabled once `sources.length >= maxSources`. Defaults to no cap. */
  maxSources?: number;
  /** When false, the "Add a topic" button is omitted. Onboarding's quick
   * setup uses this to keep the picker focused on real source material. */
  allowTopics?: boolean;
};

export function SourcesEditor({
  sources,
  setSources,
  maxSources,
  allowTopics = true,
}: SourcesEditorProps) {
  const [activeKind, setActiveKind] = useState<"link" | "file" | "topic" | null>(
    null,
  );

  const removeSource = (id: string) =>
    setSources((prev) => prev.filter((s) => s.id !== id));

  const atCap = typeof maxSources === "number" && sources.length >= maxSources;

  return (
    <div className="flex flex-col gap-3">
      {sources.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <SourceIcon source={s} />
              <div className="min-w-0 flex-1">
                {s.kind === "link" ? (
                  <>
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.domain ?? s.url}
                    </div>
                  </>
                ) : s.kind === "file" ? (
                  <>
                    <div className="truncate font-medium">{s.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Uploaded {s.fileType}
                    </div>
                  </>
                ) : (
                  <div className="truncate font-medium">{s.text}</div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSource(s.id)}
                aria-label="Remove source"
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveKind("link")}
          disabled={atCap}
        >
          <LinkIcon className="mr-2 size-4" /> Add a link
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveKind("file")}
          disabled={atCap}
        >
          <FileTextIcon className="mr-2 size-4" /> Upload file
        </Button>
        {allowTopics ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveKind("topic")}
            disabled={atCap}
          >
            <TagIcon className="mr-2 size-4" /> Add a topic
          </Button>
        ) : null}
      </div>
      {atCap && activeKind === null ? (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxSources} source{maxSources === 1 ? "" : "s"} reached.
          Remove one to swap it out.
        </p>
      ) : null}
      {activeKind === "link" ? (
        <AddLinkPanel
          onCancel={() => setActiveKind(null)}
          onAdded={(payload) => {
            setSources((prev) => [
              ...prev,
              {
                kind: "link",
                id: crypto.randomUUID(),
                resourceId: payload.resourceId,
                title: payload.title,
                url: payload.url,
                domain: payload.domain,
              },
            ]);
            setActiveKind(null);
          }}
        />
      ) : null}
      {activeKind === "file" ? (
        <AddFilePanel
          onCancel={() => setActiveKind(null)}
          onAdded={(payload) => {
            setSources((prev) => [
              ...prev,
              {
                kind: "file",
                id: crypto.randomUUID(),
                resourceId: payload.resourceId,
                title: payload.title,
                fileType: payload.fileType,
              },
            ]);
            setActiveKind(null);
          }}
        />
      ) : null}
      {activeKind === "topic" && allowTopics ? (
        <AddTopicPanel
          onCancel={() => setActiveKind(null)}
          onAdded={(text) => {
            setSources((prev) => [
              ...prev,
              { kind: "topic", id: crypto.randomUUID(), text },
            ]);
            setActiveKind(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SourceIcon({ source }: { source: Source }) {
  if (source.kind === "link")
    return <LinkIcon className="size-4 text-muted-foreground" />;
  if (source.kind === "file")
    return <FileTextIcon className="size-4 text-muted-foreground" />;
  return <TagIcon className="size-4 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// AddLinkPanel — inline form that synchronously creates a LINK Resource via
// `createResourceLink({ requireExtraction: true })`. The hard-reject policy
// for unreachable / paywalled URLs lives server-side; on failure we toast
// the message and stay open so the user can fix the URL.
// ---------------------------------------------------------------------------

export function AddLinkPanel({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (payload: {
    resourceId: string;
    title: string;
    url: string;
    domain: string | null;
  }) => void;
}) {
  const trpc = useTRPC();
  const [url, setUrl] = useState("");
  const create = useMutation(
    trpc.createResourceLink.mutationOptions({
      onSuccess: (data, variables) => {
        const trimmed = variables.url.trim();
        let domain: string | null = null;
        try {
          domain = new URL(trimmed).hostname.replace(/^www\./, "");
        } catch {
          /* ignore */
        }
        onAdded({
          resourceId: data.id,
          title: domain ?? trimmed,
          url: trimmed,
          domain,
        });
      },
      onError: (err) => toast.error(err.message ?? "Couldn't add this link"),
    }),
  );
  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    create.mutate({ url: trimmed, requireExtraction: true });
  };
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-url">Paste a URL</Label>
        <Input
          id="source-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://catalog.mit.edu/…"
          autoFocus
          disabled={create.isPending}
        />
        <p className="text-xs text-muted-foreground">
          Course catalogs, syllabi, journal articles, dissertations, and other
          academic resources work best. Social-media links are rejected.
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={create.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={!url.trim() || create.isPending}
        >
          {create.isPending ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" /> Extracting…
            </>
          ) : (
            "Add link"
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddFilePanel — inline file picker. PUTs to a signed R2 URL minted by
// `createResourceFile`, then confirms server-side. Toasts errors and stays
// open on failure so the user can try a different file.
// ---------------------------------------------------------------------------

export function AddFilePanel({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (payload: {
    resourceId: string;
    title: string;
    fileType: string;
  }) => void;
}) {
  const trpc = useTRPC();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const createFile = useMutation(
    trpc.createResourceFile.mutationOptions({
      onError: (err) => toast.error(err.message ?? "Couldn't start upload"),
    }),
  );
  const confirm = useMutation(
    trpc.confirmResourceUpload.mutationOptions({
      onError: (err) => toast.error(err.message ?? "Couldn't finalise upload"),
    }),
  );

  const upload = async () => {
    if (!file) return;
    const fileType = inferFileType(file);
    if (!fileType) {
      toast.error("Only PDF, TXT, or MD files are supported.");
      return;
    }
    setUploading(true);
    try {
      const started = await createFile.mutateAsync({
        fileName: file.name,
        fileType,
        fileSize: file.size,
        fileMimeType: file.type || defaultMime(fileType),
      });
      const putRes = await fetch(started.uploadUrl, {
        method: "PUT",
        body: file,
        headers: started.uploadHeaders,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (HTTP ${putRes.status})`);
      }
      await confirm.mutateAsync({ id: started.id });
      onAdded({
        resourceId: started.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        fileType,
      });
    } catch (err) {
      toast.error((err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-md border border-dashed border-border bg-background p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-file">Upload file</Label>
        <input
          ref={inputRef}
          id="source-file"
          type="file"
          accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown,text/x-markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={uploading}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          PDF, TXT, or Markdown. Max 50 MB per file.
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={uploading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={upload}
          disabled={!file || uploading}
        >
          {uploading ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" /> Uploading…
            </>
          ) : (
            "Upload"
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddTopicPanel — single-line "extra topic" chip editor. Topics are weaved
// into the prompt as plain text so the AI treats them as additional anchors.
// ---------------------------------------------------------------------------

export function AddTopicPanel({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-topic">Extra topic</Label>
        <Input
          id="source-topic"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Bayesian probability, Stoic ethics"
          maxLength={200}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          A short free-text topic that should be woven into the curriculum.
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (text.trim()) onAdded(text.trim());
          }}
          disabled={!text.trim()}
        >
          Add topic
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers — exported so non-picker callers can reuse the same MIME/file-type
// detection (e.g. an upload-on-paste flow that bypasses the editor).
// ---------------------------------------------------------------------------

export function inferFileType(file: File | null): "TXT" | "PDF" | "MD" | null {
  if (!file) return null;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "MD";
  if (name.endsWith(".txt")) return "TXT";
  if (file.type === "application/pdf") return "PDF";
  if (file.type === "text/markdown" || file.type === "text/x-markdown")
    return "MD";
  if (file.type === "text/plain") return "TXT";
  return null;
}

export function defaultMime(fileType: "TXT" | "PDF" | "MD"): string {
  if (fileType === "PDF") return "application/pdf";
  if (fileType === "MD") return "text/markdown";
  return "text/plain";
}

// Split sources into the shape the curriculum-create tRPC mutations expect
// (`resourceIds` + `extraTopics`). Kept here so callers don't have to
// re-derive the partitions every time.
export function partitionSourcesForMutation(sources: Source[]): {
  resourceIds: string[];
  extraTopics: string[];
} {
  const resourceIds: string[] = [];
  const extraTopics: string[] = [];
  for (const s of sources) {
    if (s.kind === "topic") extraTopics.push(s.text.trim());
    else resourceIds.push(s.resourceId);
  }
  return { resourceIds, extraTopics };
}
