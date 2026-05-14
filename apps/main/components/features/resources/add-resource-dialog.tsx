"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@quazom-ai/ui/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@quazom-ai/ui/components/ui/tabs";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { FileTextIcon, LinkIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import {
  RESOURCE_DESCRIPTION_MAX_LENGTH,
  RESOURCE_FILE_MAX_BYTES,
  RESOURCE_TITLE_MAX_LENGTH,
  type ResourceFileType,
  resourceFileExtensions,
  resourceMimeTypes,
} from "@/inngest/schemas";

type Scope = {
  curriculumId?: string;
  lessonId?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Curriculum and/or lesson to auto-pin the new resource to. Omitted ⇒
   *  resource lives in the user's personal collection only. */
  scope?: Scope;
  /** Friendly label shown above the form (e.g. "Adding to {lesson title}"). */
  scopeLabel?: string;
  /** Fired after a successful save with the new resource id. */
  onAdded?: (resourceId: string) => void;
};

/**
 * Dialog used everywhere a user adds a resource — the /resources page, the
 * lesson hero, and the curriculum Resources tab all hand the same component
 * different `scope`/`scopeLabel` props. Two tabs: paste a link, or upload a
 * file (TXT / PDF / MD).
 */
export function AddResourceDialog({
  open,
  onOpenChange,
  scope,
  scopeLabel,
  onAdded,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open ? (
          <AddResourceForm
            key={`${scope?.curriculumId ?? ""}:${scope?.lessonId ?? ""}`}
            scope={scope}
            scopeLabel={scopeLabel}
            onClose={() => onOpenChange(false)}
            onAdded={onAdded}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddResourceForm({
  scope,
  scopeLabel,
  onClose,
  onAdded,
}: {
  scope?: Scope;
  scopeLabel?: string;
  onClose: () => void;
  onAdded?: (resourceId: string) => void;
}) {
  const [tab, setTab] = useState<"link" | "file">("link");

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add a resource</DialogTitle>
        <DialogDescription>
          Save an article, wiki page, or upload a TXT / PDF / Markdown file
          to view, annotate, and quote inside Quazom.
        </DialogDescription>
      </DialogHeader>
      {scopeLabel ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Adding to:</span>
          <span className="truncate">{scopeLabel}</span>
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="link" className="cursor-pointer">
            <LinkIcon className="size-4" />
            Saved link
          </TabsTrigger>
          <TabsTrigger value="file" className="cursor-pointer">
            <UploadCloudIcon className="size-4" />
            Upload file
          </TabsTrigger>
        </TabsList>
        <TabsContent value="link" className="mt-4">
          <LinkForm scope={scope} onClose={onClose} onAdded={onAdded} />
        </TabsContent>
        <TabsContent value="file" className="mt-4">
          <FileForm scope={scope} onClose={onClose} onAdded={onAdded} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Link tab ------------------------------------------------------------

function LinkForm({
  scope,
  onClose,
  onAdded,
}: {
  scope?: Scope;
  onClose: () => void;
  onAdded?: (id: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation(
    trpc.createResourceLink.mutationOptions({
      onSuccess: ({ id }) => {
        toast.success("Resource saved");
        void queryClient.invalidateQueries({
          queryKey: trpc.listResources.pathKey(),
        });
        onAdded?.(id);
        onClose();
      },
      onError: (err) => toast.error(err.message ?? "Failed to save resource"),
    }),
  );

  const trimmed = url.trim();
  const valid = isLikelyHttpUrl(trimmed);
  const disabled = !valid || create.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate({
      url: trimmed,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      scope: scopeOrUndefined(scope),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-url">Link</Label>
        <Input
          id="resource-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://en.wikipedia.org/wiki/…"
          autoFocus
          required
        />
        <p className="text-xs text-muted-foreground">
          Articles, wikis, Reddit threads — anything you can read in a
          browser. Quazom extracts the main content for annotation; you can
          flip back to the raw page from the viewer.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-title">Title (optional)</Label>
        <Input
          id="resource-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={RESOURCE_TITLE_MAX_LENGTH}
          placeholder="Defaults to the page title or URL"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-description">Description (optional)</Label>
        <Textarea
          id="resource-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={RESOURCE_DESCRIPTION_MAX_LENGTH}
          placeholder="Why is this useful to your studies?"
          className="min-h-[80px]"
        />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={create.isPending}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={disabled} className="cursor-pointer">
          {create.isPending ? "Saving…" : "Save link"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---- File tab ------------------------------------------------------------

function FileForm({
  scope,
  onClose,
  onAdded,
}: {
  scope?: Scope;
  onClose: () => void;
  onAdded?: (id: string) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const createFile = useMutation(
    trpc.createResourceFile.mutationOptions({
      onError: (err) => toast.error(err.message ?? "Failed to start upload"),
    }),
  );
  const confirm = useMutation(
    trpc.confirmResourceUpload.mutationOptions({
      onError: (err) => toast.error(err.message ?? "Failed to finalise upload"),
    }),
  );
  const deleteResource = useMutation(
    trpc.deleteResource.mutationOptions({
      onError: () => {},
    }),
  );

  const inferred = inferFileType(file);

  const handlePick = (next: File | null) => {
    setFile(next);
    if (next) {
      const base = next.name.replace(/\.[^.]+$/, "");
      if (!title.trim()) setTitle(base);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !inferred) return;
    if (file.size > RESOURCE_FILE_MAX_BYTES) {
      toast.error(
        `File is too large (${formatBytes(file.size)}). Max is ${formatBytes(
          RESOURCE_FILE_MAX_BYTES,
        )}.`,
      );
      return;
    }

    setUploading(true);
    setProgress(0);
    let resourceId: string | null = null;
    try {
      // The browser sometimes leaves `file.type` empty (notably for `.md`
      // on macOS). Whatever we send here is what the server bakes into the
      // signed URL, so we must send the same string on the PUT below.
      const signedMime = file.type || resourceMimeTypes[inferred][0]!;
      const { id, uploadUrl, uploadHeaders } = await createFile.mutateAsync({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        fileName: file.name,
        fileType: inferred,
        fileSize: file.size,
        fileMimeType: signedMime,
        scope: scopeOrUndefined(scope),
      });
      resourceId = id;

      await uploadToSignedUrl({
        url: uploadUrl,
        file,
        headers: uploadHeaders,
        onProgress: (pct) => setProgress(pct),
      });

      await confirm.mutateAsync({ id });
      toast.success("Resource uploaded");
      void queryClient.invalidateQueries({
        queryKey: trpc.listResources.pathKey(),
      });
      onAdded?.(id);
      onClose();
    } catch (err) {
      console.error(err);
      if (resourceId) {
        // Best-effort cleanup so a half-uploaded file doesn't leave a
        // stranded row in the user's resources list.
        deleteResource.mutate({ id: resourceId });
      }
      toast.error(
        err instanceof Error ? err.message : "Failed to upload resource",
      );
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>File</Label>
        <input
          ref={inputRef}
          type="file"
          accept={allAcceptedExtensions().join(",")}
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {inferred ?? "Unsupported"} · {formatBytes(file.size)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => handlePick(null)}
              className="cursor-pointer"
              aria-label="Clear selected file"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
          >
            <UploadCloudIcon className="size-6" />
            <span className="font-medium text-foreground">
              Click to select a file
            </span>
            <span className="text-xs">
              TXT, PDF, or MD · up to {formatBytes(RESOURCE_FILE_MAX_BYTES)}
            </span>
          </button>
        )}
        {file && !inferred ? (
          <p className="text-xs text-destructive">
            Unsupported file type — please pick a .txt, .pdf, or .md file.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {(["TXT", "PDF", "MD"] as ResourceFileType[]).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-file-title">Title (optional)</Label>
        <Input
          id="resource-file-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={RESOURCE_TITLE_MAX_LENGTH}
          placeholder="Defaults to the filename"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-file-description">
          Description (optional)
        </Label>
        <Textarea
          id="resource-file-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={RESOURCE_DESCRIPTION_MAX_LENGTH}
          placeholder="Why is this useful to your studies?"
          className="min-h-[80px]"
        />
      </div>

      {progress !== null ? (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Uploading… {progress}%
          </span>
        </div>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={uploading}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!file || !inferred || uploading}
          className="cursor-pointer"
        >
          {uploading ? "Uploading…" : "Upload file"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---- Helpers -------------------------------------------------------------

function isLikelyHttpUrl(input: string): boolean {
  if (!input) return false;
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function scopeOrUndefined(scope?: Scope) {
  if (!scope) return undefined;
  const out: Scope = {};
  if (scope.curriculumId) out.curriculumId = scope.curriculumId;
  if (scope.lessonId) out.lessonId = scope.lessonId;
  return Object.keys(out).length === 0 ? undefined : out;
}

function inferFileType(file: File | null): ResourceFileType | null {
  if (!file) return null;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "PDF";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "MD";
  if (name.endsWith(".txt") || type === "text/plain") return "TXT";
  // Text files often come through with type "text/markdown" — accept those
  // as MD because the user clearly picked markdown intentionally.
  if (type.includes("markdown")) return "MD";
  return null;
}

function allAcceptedExtensions(): string[] {
  return Object.values(resourceFileExtensions).flat();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadToSignedUrl(opts: {
  url: string;
  file: File;
  /** Headers the server signed into the URL. Must be sent verbatim or R2
   *  returns 403 SignatureDoesNotMatch. */
  headers: Record<string, string>;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  // We use XHR (not fetch) so we can report upload progress to the user —
  // fetch doesn't expose an upload-side progress event yet.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", opts.url);
    for (const [name, value] of Object.entries(opts.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && opts.onProgress) {
        const pct = Math.round((event.loaded / event.total) * 100);
        opts.onProgress(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            `Upload failed: ${xhr.status} ${xhr.statusText || "unknown"}${
              xhr.responseText ? ` — ${xhr.responseText.slice(0, 200)}` : ""
            }`,
          ),
        );
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(opts.file);
  });
}
