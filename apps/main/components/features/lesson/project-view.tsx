"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { useTRPC } from "@/trpc/client";
import type { LessonDetail } from "@/lib/queries/lesson";
import { Highlightable } from "./highlightable";
import { LessonNotesPanel } from "./lesson-notes-panel";

type Props = {
  lesson: LessonDetail;
};

export function ProjectView({ lesson }: Props) {
  const project = lesson.project;
  const router = useRouter();
  const trpc = useTRPC();
  const [url, setUrl] = useState(project?.submissionUrl ?? "");

  const submit = useMutation(
    trpc.submitProjectUrl.mutationOptions({
      onSuccess: () => {
        toast.success("Project submission saved");
        router.refresh();
      },
      onError: (err) => toast.error(err.message ?? "Failed to submit"),
    }),
  );

  if (!project) {
    return <p className="text-sm text-muted-foreground">No project details available.</p>;
  }

  const embedUrl = toEmbeddable(project.submissionUrl);

  return (
    <Highlightable
      lessonId={lesson.id}
      curriculumId={lesson.module.curriculum.id}
    >
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Project brief</h2>
          <Badge variant="secondary" className="capitalize">
            {project.projectType.replace("_", " ").toLowerCase()}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{project.summary}</p>
      </section>

      {project.objectives.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">Rubric</h2>
          <p className="text-sm text-muted-foreground">
            Your submission should demonstrate each of these.
          </p>
          <ol className="flex flex-col gap-3">
            {[...project.objectives]
              .sort((a, b) => a.order - b.order)
              .map((o) => (
                <li
                  key={`${o.order}-${o.title}`}
                  className="flex gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-medium text-muted-foreground">
                    {o.order}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-medium">{o.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {o.description}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-5">
        <h2 className="font-heading text-lg font-semibold">Your submission</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = url.trim();
            if (!trimmed) {
              toast.error("Enter a URL.");
              return;
            }
            submit.mutate({ projectId: project.id, submissionUrl: trimmed });
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="submissionUrl">Public URL</Label>
            <Input
              id="submissionUrl"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Paste a link to your presentation, repo, document, or wherever you
              hosted your work. We&apos;ll preview it below when possible.
            </p>
          </div>
          <div className="flex items-center justify-end">
            <Button type="submit" disabled={submit.isPending} className="cursor-pointer">
              {submit.isPending ? "Saving…" : project.submissionUrl ? "Update submission" : "Submit"}
            </Button>
          </div>
        </form>

        {project.submissionUrl ? (
          <div className="flex flex-col gap-3 pt-2">
            <a
              href={project.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLinkIcon className="size-3.5" />
              {project.submissionUrl}
            </a>
            {embedUrl ? (
              <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-card">
                <iframe
                  src={embedUrl}
                  title="Project preview"
                  className="h-full w-full"
                  allow="fullscreen"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <LessonNotesPanel
        lessonId={lesson.id}
        curriculumId={lesson.module.curriculum.id}
      />
    </div>
    </Highlightable>
  );
}

// Lightweight allow-list for URL embedding. We only embed sources that
// reliably allow iframes; everything else falls through to the link.
function toEmbeddable(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) return rawUrl;
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (url.hostname.includes("docs.google.com")) {
      // Google Docs/Slides share URLs are embeddable as /preview.
      if (url.pathname.match(/\/(document|presentation|spreadsheets)\//)) {
        return rawUrl.replace(/\/edit.*$/, "/preview");
      }
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}
