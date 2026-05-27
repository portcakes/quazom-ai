"use client";

import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@quazom-ai/ui/components/ui/dialog";
import { Input } from "@quazom-ai/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quazom-ai/ui/components/ui/select";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@quazom-ai/ui/components/ui/popover";
import {
  PlusIcon,
  LinkIcon,
  FileTextIcon,
  XIcon,
  TagIcon,
  ListFilterIcon,
  BookOpenIcon,
  SparklesIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRealtime } from "inngest/react";
import { useTRPC, useTRPCClient } from "@/trpc/client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useCourseList } from "./course-list/course-list-provider";
import { userChannel } from "@/inngest/channels";
import { lessonActivityTypes, type LessonActivityType } from "@/inngest/schemas";

const LESSON_TYPE_LABELS: Record<LessonActivityType, string> = {
  reading: "Readings",
  quiz: "Quizzes",
  exercise: "Exercises",
  practice: "Practice",
  project: "Projects",
  discussion: "Discussions",
  video: "Videos",
  other: "Other",
};
// `practice` collapses into EXERCISE on persist, so we don't expose it as a
// separate user-facing checkbox.
const VISIBLE_LESSON_TYPES: LessonActivityType[] = lessonActivityTypes.filter(
  (t) => t !== "practice",
) as LessonActivityType[];

type LinkSource = {
  kind: "link";
  id: string; // local UUID
  resourceId: string;
  title: string;
  url: string;
  domain: string | null;
};
type FileSource = {
  kind: "file";
  id: string;
  resourceId: string;
  title: string;
  fileType: string;
};
type TopicSource = {
  kind: "topic";
  id: string;
  text: string;
};
type ContinuityNoteSelection = {
  id: string;
  title: string;
};

type Source = LinkSource | FileSource | TopicSource;

type Props = {
  /**
   * Optional callback fired after a curriculum has been queued for creation.
   * The mobile sidebar uses this to dismiss itself so the user lands on the
   * new curriculum without the off-canvas sheet still covering the screen.
   */
  onCreated?: () => void;
};

const NewCurriculumModal = ({ onCreated }: Props = {}) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex cursor-pointer items-center rounded-md p-2 hover:bg-sidebar-accent">
          <PlusIcon className="mr-2 size-4" />
          <span className="text-sm font-medium text-foreground">
            New Curriculum
          </span>
        </div>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {open ? (
          <NewCurriculumForm
            onClose={() => setOpen(false)}
            onCreated={onCreated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default NewCurriculumModal;

function NewCurriculumForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: () => void;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const { addPending } = useCourseList();

  // ---- Core form fields ----
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">(
    "beginner",
  );
  const [goal, setGoal] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [includedTypes, setIncludedTypes] = useState<Set<LessonActivityType>>(
    new Set(VISIBLE_LESSON_TYPES),
  );

  // Auto-grow the Goal textarea to fit its content. Word-wrap maintains the
  // column width inside the 2-column grid; height grows so a long goal stays
  // fully visible without an inner scrollbar.
  const goalRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;
    // Reset before measuring so shrinking back to a shorter goal also works.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [goal]);
  const [thesis, setThesis] = useState("");
  const [referencedNotes, setReferencedNotes] = useState<
    ContinuityNoteSelection[]
  >([]);

  const sourceCount = sources.length;
  const isContinuity = sourceCount >= 2;

  // ---- Quota snapshot for the footer indicator ----
  // Endpoint is named `getAlphaUsage` for historical reasons but returns
  // the full per-feature usage snapshot from `getPlanUsage`.
  const planUsageQuery = useQuery(trpc.getAlphaUsage.queryOptions());
  const usage = planUsageQuery.data;
  const quotaRow = isContinuity
    ? usage?.continuityCurricula
    : usage?.curricula;

  // ---- Create mutations ----
  const createSingle = useMutation(
    trpc.createCurriculum.mutationOptions({
      onSuccess: ({ id }) => {
        addPending({ tempId: id, subject: subject || "Curriculum" });
        toast.success("Curriculum creation started");
        onCreated?.();
        onClose();
        router.push(`/curricula/${id}`);
      },
      onError: (err) =>
        toast.error(err.message ?? "Failed to create curriculum"),
    }),
  );
  const createContinuity = useMutation(
    trpc.createContinuityCurriculum.mutationOptions({
      onSuccess: ({ id }) => {
        addPending({
          tempId: id,
          subject: subject || "Continuity Curriculum",
        });
        toast.success("Continuity Curriculum creation started");
        onCreated?.();
        onClose();
        router.push(`/curricula/${id}`);
      },
      onError: (err) =>
        toast.error(err.message ?? "Failed to create curriculum"),
    }),
  );
  const submitting = createSingle.isPending || createContinuity.isPending;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    const hasSubject = subject.trim().length > 0;
    if (sourceCount === 0 && !hasSubject) return false;
    if (includedTypes.size === 0) return false;
    return true;
  }, [submitting, subject, sourceCount, includedTypes.size]);

  const handleSubmit = () => {
    const id = crypto.randomUUID();
    // Persisted enum collapses `practice` into EXERCISE, but the checkbox
    // list doesn't expose `practice` separately so we just forward what's
    // selected.
    const includedActivityTypes = Array.from(includedTypes);
    const resourceIds = sources
      .filter((s): s is LinkSource | FileSource => s.kind !== "topic")
      .map((s) => s.resourceId);
    const extraTopics = sources
      .filter((s): s is TopicSource => s.kind === "topic")
      .map((s) => s.text.trim());

    if (isContinuity) {
      createContinuity.mutate({
        id,
        subject: subject.trim(),
        level,
        goal: goal.trim(),
        thesis: thesis.trim(),
        resourceIds,
        extraTopics,
        continuityNoteIds: referencedNotes.map((n) => n.id),
        includedActivityTypes,
      });
    } else {
      createSingle.mutate({
        id,
        subject: subject.trim(),
        level,
        goal: goal.trim(),
        resourceIds,
        extraTopics,
        includedActivityTypes,
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>New Curriculum</DialogTitle>
        <DialogDescription>
          Start from a topic, or attach links and uploads to build a multi-source
          Continuity Curriculum.
        </DialogDescription>
      </DialogHeader>

      <Section title="Topic" description="Pick a subject or let your sources anchor the curriculum.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-curriculum-subject">Subject {sourceCount > 0 ? "(optional)" : ""}</Label>
            <Input
              id="new-curriculum-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Network theory, Renaissance art, …"
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-curriculum-level">Level</Label>
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as typeof level)}
              >
                <SelectTrigger id="new-curriculum-level">
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-curriculum-goal">Goal {sourceCount > 0 ? "(optional)" : ""}</Label>
              <Textarea
                id="new-curriculum-goal"
                ref={goalRef}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="My goal is to…"
                maxLength={2000}
                rows={1}
                // Word-wrap inside the column; height grows via the useEffect
                // above so the whole goal stays visible. `resize-none`
                // disables the manual drag handle since the field auto-fits.
                className="min-h-9 resize-none overflow-hidden leading-relaxed"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Sources"
        description={`Add links to course catalogs, syllabi, journal articles, or upload PDF/TXT/MD files. Two or more sources promotes this to a Continuity Curriculum.`}
      >
        <SourcesEditor sources={sources} setSources={setSources} />
      </Section>

      <Section
        title="Lesson types"
        description="Uncheck any lesson types you don't want generated for this curriculum."
      >
        <LessonTypeFilter selected={includedTypes} setSelected={setIncludedTypes} />
      </Section>

      {isContinuity ? (
        <Section
          title="Thesis (optional)"
          description="Anchor the curriculum with a single thesis statement, or generate one from your continuity notes."
        >
          <ThesisEditor
            thesis={thesis}
            setThesis={setThesis}
            referencedNotes={referencedNotes}
            setReferencedNotes={setReferencedNotes}
            subject={subject}
            goal={goal}
          />
        </Section>
      ) : null}

      <DialogFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>
            {isContinuity ? "Continuity" : "Single-source"} curriculum
            {sourceCount > 0 ? ` · ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : ""}
          </span>
          {quotaRow ? (
            <span>
              Usage: {quotaRow.used}
              {quotaRow.limit !== null ? ` / ${quotaRow.limit}` : ""}{" "}
              {quotaRow.period === "lifetime" ? "lifetime" : "this month"}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting
              ? "Creating…"
              : isContinuity
                ? "Create Continuity Curriculum"
                : "Create"}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sources editor
// ---------------------------------------------------------------------------

function SourcesEditor({
  sources,
  setSources,
}: {
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
}) {
  const [activeKind, setActiveKind] = useState<"link" | "file" | "topic" | null>(
    null,
  );

  const removeSource = (id: string) =>
    setSources((prev) => prev.filter((s) => s.id !== id));

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
        >
          <LinkIcon className="mr-2 size-4" /> Add a link
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveKind("file")}
        >
          <FileTextIcon className="mr-2 size-4" /> Upload file
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActiveKind("topic")}
        >
          <TagIcon className="mr-2 size-4" /> Add a topic
        </Button>
      </div>
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
      {activeKind === "topic" ? (
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
  if (source.kind === "link") return <LinkIcon className="size-4 text-muted-foreground" />;
  if (source.kind === "file") return <FileTextIcon className="size-4 text-muted-foreground" />;
  return <TagIcon className="size-4 text-muted-foreground" />;
}

function AddLinkPanel({
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
  // Strip everything but the URL from the form to keep the flow lean; the
  // user can still add a description later from the resource viewer.
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

function AddFilePanel({
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
      // Direct PUT to the signed URL — we don't surface a progress bar in
      // this compact picker to keep the modal small; the resource upload
      // dialog elsewhere covers the progress UX.
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

function AddTopicPanel({
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
// Lesson-type filter
// ---------------------------------------------------------------------------

function LessonTypeFilter({
  selected,
  setSelected,
}: {
  selected: Set<LessonActivityType>;
  setSelected: React.Dispatch<React.SetStateAction<Set<LessonActivityType>>>;
}) {
  const toggle = (type: LessonActivityType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ListFilterIcon className="mr-2 size-4" />
          {selected.size === VISIBLE_LESSON_TYPES.length
            ? "All lesson types"
            : selected.size === 0
              ? "No lesson types selected"
              : `${selected.size} lesson type${selected.size === 1 ? "" : "s"}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <ul className="flex flex-col">
          {VISIBLE_LESSON_TYPES.map((type) => (
            <li key={type}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={selected.has(type)}
                  onChange={() => toggle(type)}
                />
                {LESSON_TYPE_LABELS[type]}
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Thesis editor (continuity only)
// ---------------------------------------------------------------------------

function ThesisEditor({
  thesis,
  setThesis,
  referencedNotes,
  setReferencedNotes,
  subject,
  goal,
}: {
  thesis: string;
  setThesis: React.Dispatch<React.SetStateAction<string>>;
  referencedNotes: ContinuityNoteSelection[];
  setReferencedNotes: React.Dispatch<
    React.SetStateAction<ContinuityNoteSelection[]>
  >;
  subject: string;
  goal: string;
}) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const { userId } = useCourseList();
  const notesQuery = useQuery(trpc.listContinuityNotes.queryOptions());
  const notes = notesQuery.data ?? [];

  const [requestId, setRequestId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const generate = useMutation(
    trpc.generateThesisFromNotes.mutationOptions({
      onError: (err) => {
        setGenerating(false);
        toast.error(err.message ?? "Couldn't kick off thesis generation");
      },
    }),
  );

  // Realtime subscription scoped to this modal so multiple concurrent
  // generations (different note picks) don't clobber each other — the
  // `requestId` we mint client-side matches against the `thesisReady`
  // payload before we apply it to the textarea.
  const tokenFactory = useCallback(async () => {
    const token = await trpcClient.realtimeToken.query();
    if (!token.key) throw new Error("Failed to mint realtime subscription");
    return typeof token.apiBaseUrl === "string"
      ? { key: token.key, apiBaseUrl: token.apiBaseUrl }
      : token.key;
  }, [trpcClient]);
  const channel = useMemo(() => userChannel(userId), [userId]);
  const { messages } = useRealtime({
    channel,
    topics: ["thesisReady", "thesisFailed"] as const,
    token: tokenFactory,
  });

  // Dedupe-keys for the realtime messages: the useRealtime hook surfaces
  // the latest message of each topic, so without a ref we'd react every
  // time React re-rendered for any other reason. Pattern mirrors
  // course-list-provider.tsx.
  const lastHandledRef = useRef<{ ready?: string; failed?: string }>({});

  useEffect(() => {
    const latest = messages.byTopic.thesisReady;
    if (!latest || latest.kind !== "data") return;
    const data = latest.data as { requestId: string; thesis: string };
    if (data.requestId !== requestId) return;
    const key = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current.ready === key) return;
    lastHandledRef.current.ready = key;
    setThesis(data.thesis);
    setGenerating(false);
    toast.success("Thesis generated from your notes");
  }, [messages.byTopic.thesisReady, requestId, setThesis]);

  useEffect(() => {
    const latest = messages.byTopic.thesisFailed;
    if (!latest || latest.kind !== "data") return;
    const data = latest.data as { requestId: string; message: string };
    if (data.requestId !== requestId) return;
    const key = `${latest.runId ?? ""}:${latest.createdAt?.toISOString?.() ?? ""}`;
    if (lastHandledRef.current.failed === key) return;
    lastHandledRef.current.failed = key;
    setGenerating(false);
    toast.error(`Thesis generation failed: ${data.message}`);
  }, [messages.byTopic.thesisFailed, requestId]);

  const startGeneration = () => {
    if (referencedNotes.length === 0) {
      toast.error("Select at least one continuity note");
      return;
    }
    const rid = crypto.randomUUID();
    setRequestId(rid);
    setGenerating(true);
    generate.mutate({
      requestId: rid,
      continuityNoteIds: referencedNotes.map((n) => n.id),
      subject: subject || undefined,
      goal: goal || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        placeholder="Optional thesis statement — 1-3 sentences."
        rows={3}
        maxLength={2000}
      />
      <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-background p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpenIcon className="size-4" />
          Generate from selected continuity notes:
        </div>
        <NotesPicker
          notes={notes.map((n) => ({ id: n.id, title: n.title ?? "Untitled note" }))}
          selected={referencedNotes}
          setSelected={setReferencedNotes}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={startGeneration}
            disabled={referencedNotes.length === 0 || generating}
          >
            {generating ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <SparklesIcon className="mr-2 size-4" /> Generate thesis
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotesPicker({
  notes,
  selected,
  setSelected,
}: {
  notes: ContinuityNoteSelection[];
  selected: ContinuityNoteSelection[];
  setSelected: React.Dispatch<React.SetStateAction<ContinuityNoteSelection[]>>;
}) {
  if (notes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No continuity notes yet. Open the notes panel to start writing one.
      </p>
    );
  }
  const toggle = (note: ContinuityNoteSelection) => {
    setSelected((prev) =>
      prev.find((n) => n.id === note.id)
        ? prev.filter((n) => n.id !== note.id)
        : [...prev, note],
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {selected.map((n) => (
          <Badge
            key={n.id}
            variant="secondary"
            className="cursor-pointer"
            onClick={() => toggle(n)}
          >
            {n.title}
            <XIcon className="ml-1 size-3" />
          </Badge>
        ))}
        {selected.length === 0 ? (
          <span className="text-xs text-muted-foreground">No notes selected</span>
        ) : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <PlusIcon className="mr-2 size-4" /> Pick notes
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <ul className="max-h-60 overflow-y-auto">
            {notes.map((n) => {
              const isSelected = selected.find((s) => s.id === n.id);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => toggle(n)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={Boolean(isSelected)}
                    />
                    <span className="truncate">{n.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function inferFileType(file: File | null): "TXT" | "PDF" | "MD" | null {
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

function defaultMime(fileType: "TXT" | "PDF" | "MD"): string {
  if (fileType === "PDF") return "application/pdf";
  if (fileType === "MD") return "text/markdown";
  return "text/plain";
}
