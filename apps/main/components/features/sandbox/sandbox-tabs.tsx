"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@quazom-ai/ui/components/ui/tabs";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Switch } from "@quazom-ai/ui/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@quazom-ai/ui/components/ui/alert-dialog";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FolderGitIcon,
  ListChecksIcon,
  Loader2Icon,
  MessagesSquareIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import type {
  SandboxDetail,
  SandboxMaterialSummary,
  SandboxResearchSessionSummary,
  SandboxSourceSummary,
} from "@/lib/queries/sandbox";
import { ResearchSessionModal } from "./research-session-modal";
import { NewResearchSessionModal } from "./new-research-session-modal";
import { GenerateMaterialModal } from "./generate-material-modal";

type Props = {
  sandbox: SandboxDetail;
  userId: string;
};

export function SandboxTabs({ sandbox, userId }: Props) {
  const [chat, setChat] = useState<{ open: boolean; sessionId: string | null }>(
    { open: false, sessionId: null },
  );
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);

  const openSession = (sessionId: string) =>
    setChat({ open: true, sessionId });

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-8">
      <Tabs defaultValue="overview" className="w-full">
        <div className="sticky top-[calc(6rem_+_var(--audio-bar-offset,0px))] z-10 -mx-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-[calc(3rem_+_var(--audio-bar-offset,0px))]">
          <div className="overflow-x-auto px-6 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-fit min-w-full justify-center">
              <TabsList>
                <TabsTrigger value="overview" className="cursor-pointer">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="sources" className="cursor-pointer">
                  Sources
                </TabsTrigger>
                <TabsTrigger value="research" className="cursor-pointer">
                  Research
                </TabsTrigger>
                <TabsTrigger value="materials" className="cursor-pointer">
                  Materials
                </TabsTrigger>
                <TabsTrigger value="options" className="cursor-pointer">
                  Options
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab sandbox={sandbox} />
        </TabsContent>
        <TabsContent value="sources" className="mt-6">
          <SourcesTab sources={sandbox.sources} />
        </TabsContent>
        <TabsContent value="research" className="mt-6">
          <ResearchTab
            sessions={sandbox.researchSessions}
            hasSources={sandbox.sources.length > 0}
            onNewSession={() => setNewSessionOpen(true)}
            onOpenSession={openSession}
            onGenerateMaterial={() => setMaterialOpen(true)}
          />
        </TabsContent>
        <TabsContent value="materials" className="mt-6">
          <MaterialsTab
            materials={sandbox.materials}
            onGenerateMaterial={() => setMaterialOpen(true)}
          />
        </TabsContent>
        <TabsContent value="options" className="mt-6">
          <SandboxOptionsTab
            id={sandbox.id}
            title={sandbox.title}
            isHidden={sandbox.isHidden}
          />
        </TabsContent>
      </Tabs>

      <ResearchSessionModal
        open={chat.open}
        onOpenChange={(open) => setChat((c) => ({ ...c, open }))}
        sessionId={chat.sessionId}
        userId={userId}
      />
      <NewResearchSessionModal
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        sandboxId={sandbox.id}
        sources={sandbox.sources}
        onCreated={openSession}
      />
      <GenerateMaterialModal
        open={materialOpen}
        onOpenChange={setMaterialOpen}
        sandboxId={sandbox.id}
        sources={sandbox.sources}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({ sandbox }: { sandbox: SandboxDetail }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sources" value={sandbox.sources.length} />
        <StatCard
          label="Research sessions"
          value={sandbox.researchSessions.length}
        />
        <StatCard label="Materials" value={sandbox.materials.length} />
      </div>
      {sandbox.thesis ? (
        <div className="rounded-xl border border-border bg-card/60 p-5">
          <h3 className="font-heading text-lg font-semibold">Working thesis</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {sandbox.thesis}
          </p>
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-card/60 p-5">
        <h3 className="font-heading text-lg font-semibold">
          What can I do here?
        </h3>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Sources</strong> — review the
            links, files, topics, and notes anchoring this workspace.
          </li>
          <li>
            <strong className="text-foreground">Research</strong> — chat with an
            AI partner grounded in your sources, across as many turns as you
            like.
          </li>
          <li>
            <strong className="text-foreground">Materials</strong> — generate
            readings, quizzes, and projects that cite your sources and open in
            the lesson viewer.
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card/60 p-5">
      <span className="font-heading text-3xl font-bold tabular-nums">
        {value}
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const SOURCE_KIND_LABEL: Record<SandboxSourceSummary["kind"], string> = {
  TOPIC: "Topic",
  LINK_RESOURCE: "Link",
  FILE_RESOURCE: "File",
  CONTINUITY_NOTE: "Note",
  THESIS: "Thesis",
  QUESTION: "Question",
};

function SourcesTab({ sources }: { sources: SandboxSourceSummary[] }) {
  if (sources.length === 0) {
    return (
      <EmptyState
        title="No sources"
        description="This sandbox doesn't have any sources attached."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {sources.map((source) => (
        <li
          key={source.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-4"
        >
          <Badge variant="secondary" className="mt-0.5 shrink-0">
            {SOURCE_KIND_LABEL[source.kind]}
          </Badge>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium text-foreground">{source.label}</span>
            {source.text ? (
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {source.text}
              </p>
            ) : null}
            {source.resourceUrl ? (
              <a
                href={source.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <ExternalLinkIcon className="size-3.5" />
                {source.resourceDomain ?? source.resourceUrl}
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

function ResearchTab({
  sessions,
  hasSources,
  onNewSession,
  onOpenSession,
  onGenerateMaterial,
}: {
  sessions: SandboxResearchSessionSummary[];
  hasSources: boolean;
  onNewSession: () => void;
  onOpenSession: (id: string) => void;
  onGenerateMaterial: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Research Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Multi-turn AI conversations grounded in your sources.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onGenerateMaterial}>
            <SparklesIcon className="size-4" />
            Generate material
          </Button>
          <Button onClick={onNewSession}>
            <PlusIcon className="size-4" />
            New session
          </Button>
        </div>
      </div>

      {!hasSources ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          Tip: this sandbox has no sources yet, so research replies will rely on
          general knowledge.
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          title="No research sessions yet"
          description="Start a session to chat with an AI research partner about your sources."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onOpenSession(session.id)}
                className="flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left ring-1 ring-transparent transition-colors hover:border-foreground/20 hover:ring-foreground/10"
              >
                <div className="flex items-center gap-2 text-orange-600">
                  <MessagesSquareIcon className="size-4" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Research Session
                  </span>
                </div>
                <h3 className="font-heading text-lg font-semibold leading-tight">
                  {session.title}
                </h3>
                <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {session.messageCount} message
                    {session.messageCount === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  <span>
                    {session.sourceCount} source
                    {session.sourceCount === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const MATERIAL_ICON: Record<
  SandboxMaterialSummary["kind"],
  typeof BookOpenIcon
> = {
  READING: BookOpenIcon,
  QUIZ: ListChecksIcon,
  PROJECT: FolderGitIcon,
};

const MATERIAL_LABEL: Record<SandboxMaterialSummary["kind"], string> = {
  READING: "Reading",
  QUIZ: "Quiz",
  PROJECT: "Project",
};

function MaterialsTab({
  materials,
  onGenerateMaterial,
}: {
  materials: SandboxMaterialSummary[];
  onGenerateMaterial: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Materials
          </h2>
          <p className="text-sm text-muted-foreground">
            Readings, quizzes, and projects generated from your sources.
          </p>
        </div>
        <Button onClick={onGenerateMaterial}>
          <SparklesIcon className="size-4" />
          Generate material
        </Button>
      </div>

      {materials.length === 0 ? (
        <EmptyState
          title="No materials yet"
          description="Generate a reading, quiz, or project to turn your research into study material."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {materials.map((material) => (
            <li key={material.id} className="flex">
              <MaterialCard material={material} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MaterialCard({ material }: { material: SandboxMaterialSummary }) {
  const Icon = MATERIAL_ICON[material.kind];
  const isReady = material.status === "READY";
  const isFailed = material.status === "FAILED";
  const pending = material.status === "STUB" || material.status === "GENERATING";

  const inner = (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-colors",
        isReady
          ? "border-border ring-1 ring-transparent hover:border-foreground/20 hover:ring-foreground/10"
          : "border-border",
        material.isCompleted ? "border-emerald-500/40 bg-emerald-500/5" : null,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Icon className="size-3" />
          {MATERIAL_LABEL[material.kind]}
        </Badge>
        {pending ? (
          <Badge
            variant="outline"
            className="gap-1 border-muted bg-muted/40 text-muted-foreground"
          >
            <Loader2Icon className="size-3 animate-spin" />
            Generating
          </Badge>
        ) : null}
        {isFailed ? (
          <Badge
            variant="outline"
            className="gap-1 border-destructive/40 bg-destructive/10 text-destructive"
          >
            <AlertTriangleIcon className="size-3" />
            Failed
          </Badge>
        ) : null}
        {material.isCompleted ? (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2Icon className="size-3" />
            Complete
          </Badge>
        ) : null}
      </div>
      <h3 className="font-heading text-lg font-semibold leading-tight">
        {material.title}
      </h3>
      {pending ? (
        <p className="mt-auto text-xs text-muted-foreground">
          Your material is being generated…
        </p>
      ) : null}
    </div>
  );

  if (isReady) {
    return (
      <Link href={`/lessons/${material.lessonId}`} className="flex w-full">
        {inner}
      </Link>
    );
  }
  return <div className="flex w-full">{inner}</div>;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function SandboxOptionsTab({
  id,
  title,
  isHidden,
}: {
  id: string;
  title: string;
  isHidden: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [hidden, setHidden] = useState(isHidden);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const setHiddenMutation = useMutation(
    trpc.setSandboxHidden.mutationOptions({
      onSuccess: () => router.refresh(),
      onError: (error, variables) => {
        setHidden(!variables.isHidden);
        toast.error(error.message ?? "Failed to update visibility");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.deleteSandbox.mutationOptions({
      onSuccess: () => {
        toast.success(`Deleted "${title}"`);
        setConfirmOpen(false);
        router.push("/sandboxes");
        router.refresh();
      },
      onError: (error) => toast.error(error.message ?? "Failed to delete sandbox"),
    }),
  );

  const handleToggle = (next: boolean) => {
    setHidden(next);
    setHiddenMutation.mutate({ id, isHidden: next });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="hide-sandbox" className="text-base font-medium">
              Hide from sidebar
            </Label>
            <p className="text-sm text-muted-foreground">
              Keep this sandbox in your collection but hide it from the sidebar
              list. You can still find it on the Sandboxes page.
            </p>
          </div>
          <Switch
            id="hide-sandbox"
            checked={hidden}
            onCheckedChange={handleToggle}
            disabled={setHiddenMutation.isPending}
            aria-label="Hide sandbox from sidebar"
            className="cursor-pointer"
          />
        </div>
      </div>

      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium text-foreground">
              Delete sandbox
            </p>
            <p className="text-sm text-muted-foreground">
              Permanently remove this sandbox along with its sources, research
              sessions, and generated materials. This cannot be undone.
            </p>
          </div>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this sandbox?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;re about to permanently delete{" "}
                  <span className="font-medium text-foreground">
                    &ldquo;{title}&rdquo;
                  </span>
                  . This action cannot be undone — its sources, research
                  sessions, and generated materials will all be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    deleteMutation.mutate({ id });
                  }}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete forever"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
