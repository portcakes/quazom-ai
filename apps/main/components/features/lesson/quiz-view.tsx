"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "inngest/react";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Loader2Icon,
  RotateCcwIcon,
  SearchIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@quazom-ai/ui/components/ui/radio-group";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { useTRPC, useTRPCClient } from "@/trpc/client";
import { userChannel } from "@/inngest/channels";
import type { LessonDetail } from "@/lib/queries/lesson";
import { AnnotatedMarkdown } from "@/components/features/notes/annotated-markdown";
import { Highlightable } from "./highlightable";
import { LessonNotesPanel } from "./lesson-notes-panel";

type Props = {
  lesson: LessonDetail;
  kind: "quiz" | "exercise";
  userId: string;
};

const REALTIME_TOPICS = ["assessmentReady", "assessmentFailed"] as const;

export function QuizView({ lesson, kind, userId }: Props) {
  const data = kind === "quiz" ? lesson.quiz : lesson.exercise;

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">No assessment available for this lesson.</p>
    );
  }

  return <AssessmentBody lesson={lesson} data={data} kind={kind} userId={userId} />;
}

type QuizDataLike = NonNullable<LessonDetail["quiz"]> | NonNullable<LessonDetail["exercise"]>;

function AssessmentBody({
  lesson,
  data,
  kind,
  userId,
}: {
  lesson: LessonDetail;
  data: QuizDataLike;
  kind: "quiz" | "exercise";
  userId: string;
}) {
  return (
    <Highlightable
      lessonId={lesson.id}
      curriculumId={lesson.module.curriculum.id}
    >
      <div className="flex flex-col gap-8">
        {kind === "exercise" && "description" in data && data.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {data.description}
          </p>
        ) : null}

        <AssessmentReading data={data} />

        {data.recommendedResources.length > 0 ? (
          <StudyMaterial resources={data.recommendedResources} />
        ) : null}

        <QuestionsSection data={data} kind={kind} userId={userId} />

        <LessonNotesPanel
          lessonId={lesson.id}
          curriculumId={lesson.module.curriculum.id}
        />
      </div>
    </Highlightable>
  );
}

function AssessmentReading({ data }: { data: QuizDataLike }) {
  const hasOverview = Boolean(data.overview);
  const hasContent = Boolean(data.content);
  if (!hasOverview && !hasContent) return null;
  return (
    <>
      {hasOverview ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-5">
          <h2 className="font-heading text-lg font-semibold">Overview</h2>
          <AnnotatedMarkdown compact className="text-muted-foreground" annotations={[]}>
            {data.overview}
          </AnnotatedMarkdown>
        </section>
      ) : null}
      {hasContent ? (
        <article className="max-w-none">
          <AnnotatedMarkdown annotations={[]}>{data.content}</AnnotatedMarkdown>
        </article>
      ) : null}
    </>
  );
}

function StudyMaterial({
  resources,
}: {
  resources: QuizDataLike["recommendedResources"];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">Study material</h2>
      <p className="text-sm text-muted-foreground">
        Brush up on the topic before generating the questions — read, watch,
        then test yourself.
      </p>
      <ul className="flex flex-col gap-2">
        {resources.map((resource) => (
          <li
            key={`${resource.type}-${resource.title}`}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium">{resource.title}</h3>
              <Badge variant="secondary" className="capitalize">
                {resource.type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{resource.reason}</p>
            <a
              href={resourceSearchUrl(resource.type, resource.searchQuery)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <SearchIcon className="size-3" />
              <span className="truncate">{resource.searchQuery}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Manages the phase-2 generation flow. While `questionsGenerated` is false
// we show a "Generate" CTA; once questions exist we render the form. The
// component listens for the `assessmentReady` realtime topic so the UI
// transitions automatically when the AI job finishes.
function QuestionsSection({
  data,
  kind,
  userId,
}: {
  data: QuizDataLike;
  kind: "quiz" | "exercise";
  userId: string;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const [waiting, setWaiting] = useState(false);

  // Subscribe to realtime. When the AI finishes generating, refresh so the
  // server-rendered lesson detail pulls the new questions array.
  const { messages } = useRealtime({
    channel: userChannel(userId),
    topics: REALTIME_TOPICS,
    token: async () => {
      const token = await trpcClient.realtimeToken.query();
      return typeof token.apiBaseUrl === "string"
        ? { key: token.key, apiBaseUrl: token.apiBaseUrl }
        : token.key;
    },
  });

  // Polling fallback for the assessmentReady realtime event. Realtime is the
  // happy path, but on backgrounded tabs / flaky networks the message can
  // arrive late or not at all — without a poll the page just sits on
  // "Generating…" until the user reloads manually. Once questions land we
  // refresh and stop polling.
  const statusQuery = useQuery(
    trpc.getAssessmentStatus.queryOptions(
      { kind, id: data.id },
      {
        enabled: waiting && !data.questionsGenerated,
        refetchInterval: (q) => {
          const status = q.state.data;
          if (status?.questionsGenerated) return false;
          return 3_000;
        },
        refetchIntervalInBackground: true,
      },
    ),
  );
  useEffect(() => {
    if (!waiting) return;
    if (statusQuery.data?.questionsGenerated) {
      setWaiting(false);
      router.refresh();
      void queryClient.invalidateQueries();
    }
  }, [statusQuery.data?.questionsGenerated, waiting, router, queryClient]);

  const lastReadyKey = useRef<string | null>(null);
  useEffect(() => {
    const ready = messages.byTopic.assessmentReady;
    if (!ready || ready.kind !== "data") return;
    const payload = ready.data as { id: string; lessonId: string };
    if (payload.id !== data.id) return;
    const key = `${ready.runId ?? ""}:${ready.createdAt?.toISOString?.() ?? ""}`;
    if (lastReadyKey.current === key) return;
    lastReadyKey.current = key;
    // External system → React: documented exception to set-state-in-effect.
    setWaiting(false);
    router.refresh();
    void queryClient.invalidateQueries();
  }, [messages.byTopic.assessmentReady, data.id, router, queryClient]);

  const lastFailKey = useRef<string | null>(null);
  useEffect(() => {
    const failed = messages.byTopic.assessmentFailed;
    if (!failed || failed.kind !== "data") return;
    const payload = failed.data as { id: string; message: string };
    if (payload.id !== data.id) return;
    const key = `${failed.runId ?? ""}:${failed.createdAt?.toISOString?.() ?? ""}`;
    if (lastFailKey.current === key) return;
    lastFailKey.current = key;
    setWaiting(false);
    toast.error(payload.message ?? "Failed to generate questions");
  }, [messages.byTopic.assessmentFailed, data.id]);

  const generate = useMutation(
    trpc.generateAssessmentQuestions.mutationOptions({
      onSuccess: () => {
        setWaiting(true);
        toast.success(
          kind === "quiz" ? "Generating quiz…" : "Generating exercise…",
        );
      },
      onError: (err) => {
        setWaiting(false);
        toast.error(err.message ?? "Failed to start generation");
      },
    }),
  );

  if (!data.questionsGenerated && data.questions.length === 0) {
    const isPending = generate.isPending || waiting;
    return (
      <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/40 p-6 text-center">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-lg font-semibold">
            Ready to test yourself?
          </h3>
          <p className="text-sm text-muted-foreground">
            When you&apos;ve studied the material above, generate the{" "}
            {kind === "quiz" ? "quiz" : "exercise"} {" "}questions. They&apos;re
            sized to the module&apos;s level.
          </p>
        </div>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={isPending}
          onClick={() => generate.mutate({ kind, id: data.id })}
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <SparklesIcon className="size-4" />
              Generate {kind === "quiz" ? "quiz" : "exercise"}
            </>
          )}
        </Button>
      </section>
    );
  }

  // Only ExerciseDetail carries `hints`; type-narrow with the `kind` arg.
  const hints =
    kind === "exercise" && "hints" in data ? (data.hints ?? []) : [];

  // Keying on identity + answers + feedback re-mounts the form whenever the
  // server-side state flips (fresh generation, fresh submission, etc.), so
  // local answer state stays in sync without an explicit reset effect.
  const formKey = `${data.id}:${data.questions.length}:${data.userAnswers ? data.userAnswers.join(",") : "fresh"}:${data.feedback ? "feedback" : "no-feedback"}`;

  return (
    <QuestionsForm
      key={formKey}
      data={data}
      kind={kind}
      hints={hints}
      onRegenerate={() => generate.mutate({ kind, id: data.id })}
      regenerating={generate.isPending || waiting}
    />
  );
}

function QuestionsForm({
  data,
  kind,
  hints,
  onRegenerate,
  regenerating,
}: {
  data: QuizDataLike;
  kind: "quiz" | "exercise";
  hints: string[];
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const initialAnswers = useMemo(() => {
    if (data.userAnswers && data.userAnswers.length === data.questions.length) {
      return data.userAnswers;
    }
    return data.questions.map(() => -1);
  }, [data.userAnswers, data.questions]);

  const [answers, setAnswers] = useState<number[]>(initialAnswers);
  const [showHints, setShowHints] = useState(false);
  const [submitted, setSubmitted] = useState<boolean>(Boolean(data.isCompleted));

  const submitQuiz = useMutation(
    trpc.submitQuiz.mutationOptions({
      onSuccess: () => {
        toast.success("Submitted");
        setSubmitted(true);
        void queryClient.invalidateQueries();
      },
      onError: (err) => toast.error(err.message ?? "Failed to submit"),
    }),
  );
  const submitExercise = useMutation(
    trpc.submitExercise.mutationOptions({
      onSuccess: () => {
        toast.success("Submitted");
        setSubmitted(true);
        void queryClient.invalidateQueries();
      },
      onError: (err) => toast.error(err.message ?? "Failed to submit"),
    }),
  );

  const allAnswered = answers.every((a) => a >= 0);
  const isPending = submitQuiz.isPending || submitExercise.isPending;

  const handleSubmit = () => {
    if (!allAnswered) {
      toast.error("Answer every question before submitting.");
      return;
    }
    if (kind === "quiz") {
      submitQuiz.mutate({ quizId: data.id, answers });
    } else {
      submitExercise.mutate({ exerciseId: data.id, answers });
    }
  };

  const handleRetry = () => {
    setAnswers(data.questions.map(() => -1));
    setSubmitted(false);
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">
          {kind === "quiz" ? "Quiz" : "Exercise"}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.questions.length}{" "}
            {data.questions.length === 1 ? "question" : "questions"}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="cursor-pointer"
            disabled={regenerating}
            onClick={onRegenerate}
          >
            {regenerating ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Regenerating…
              </>
            ) : (
              <>
                <SparklesIcon className="size-3.5" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </div>

      {kind === "exercise" && hints.length > 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <button
            type="button"
            onClick={() => setShowHints((v) => !v)}
            className="text-sm font-medium hover:text-foreground/80 cursor-pointer"
          >
            {showHints
              ? "Hide hints"
              : `Show ${hints.length} hint${hints.length === 1 ? "" : "s"}`}
          </button>
          {showHints ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
              {hints.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {submitted ? <ScorePanel data={data} /> : null}

      <ol className="flex flex-col gap-4">
        {data.questions.map((question, qIdx) => {
          const userIdx = answers[qIdx] ?? -1;
          return (
            <li
              key={qIdx}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
            >
              <p className="font-medium">
                <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">
                  Q{qIdx + 1}
                </span>
                {question.question}
              </p>
              <RadioGroup
                value={userIdx >= 0 ? String(userIdx) : undefined}
                onValueChange={(v) => {
                  if (submitted) return;
                  const next = [...answers];
                  next[qIdx] = Number(v);
                  setAnswers(next);
                }}
                disabled={submitted}
                className="flex flex-col gap-2"
              >
                {question.answers.map((answer, aIdx) => {
                  const id = `q${qIdx}-a${aIdx}`;
                  const isUser = userIdx === aIdx;
                  const isCorrect = question.correctAnswerIndex === aIdx;
                  const tone = submitted
                    ? isCorrect
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : isUser
                        ? "border-destructive/50 bg-destructive/10"
                        : "border-border"
                    : "border-border hover:bg-muted/40";
                  return (
                    <Label
                      key={id}
                      htmlFor={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${tone}`}
                    >
                      <RadioGroupItem id={id} value={String(aIdx)} />
                      <span className="flex-1 text-sm">{answer}</span>
                      {submitted && isCorrect ? (
                        <CheckCircle2Icon className="size-4 text-emerald-500" />
                      ) : submitted && isUser && !isCorrect ? (
                        <XCircleIcon className="size-4 text-destructive" />
                      ) : null}
                    </Label>
                  );
                })}
              </RadioGroup>
              {submitted && question.explanation ? (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {question.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-end gap-2">
        {submitted ? (
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={handleRetry}
          >
            <RotateCcwIcon className="size-4" />
            Try again
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!allAnswered || isPending}
            onClick={handleSubmit}
            className="cursor-pointer"
          >
            {isPending ? "Submitting…" : "Submit"}
          </Button>
        )}
      </div>
    </section>
  );
}

function ScorePanel({ data }: { data: QuizDataLike }) {
  const passed = data.isPassed;
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border p-5 ${
        passed
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {passed ? (
            <CheckCircle2Icon className="size-5 text-emerald-500" />
          ) : (
            <CircleAlertIcon className="size-5 text-destructive" />
          )}
          <h3 className="font-heading text-xl font-semibold">
            {data.score}% — {passed ? "Passed" : "Keep practicing"}
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          Pass score: {data.passScore}%
        </span>
      </div>
      {data.feedback ? (
        <FeedbackBlock feedback={data.feedback} />
      ) : (
        <FeedbackPending />
      )}
    </section>
  );
}

function FeedbackPending() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-card/40 px-3 py-2 text-sm text-muted-foreground">
      <SparklesIcon className="size-4 animate-pulse" />
      Generating personalized feedback…
    </div>
  );
}

function FeedbackBlock({
  feedback,
}: {
  feedback: NonNullable<QuizDataLike["feedback"]>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed">{feedback.summary}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <FeedbackList title="Strengths" items={feedback.strengths} />
        <FeedbackList title="Weak areas" items={feedback.weakAreas} />
        <FeedbackList title="Next steps" items={feedback.nextSteps} />
      </div>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

// Match the reading-view/video-view link routing: video resources go to
// YouTube, everything else to Google.
function resourceSearchUrl(type: string, query: string): string {
  const q = encodeURIComponent(query);
  if (type === "video") {
    return `https://www.youtube.com/results?search_query=${q}`;
  }
  return `https://www.google.com/search?q=${q}`;
}
