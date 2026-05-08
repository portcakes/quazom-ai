"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  RotateCcwIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@quazom-ai/ui/components/ui/radio-group";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { useTRPC } from "@/trpc/client";
import type { LessonDetail } from "@/lib/queries/lesson";
import { LessonNotesPanel } from "./lesson-notes-panel";

type Props = {
  lesson: LessonDetail;
  kind: "quiz" | "exercise";
};

export function QuizView({ lesson, kind }: Props) {
  const data = kind === "quiz" ? lesson.quiz : lesson.exercise;

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">No questions available for this lesson.</p>
    );
  }

  // Re-mount the form whenever the server-side answer/feedback identity flips
  // (submitted / re-submitted). This keeps local form state in sync with
  // server data without a setState-in-effect.
  const formKey = `${data.id}:${data.userAnswers ? data.userAnswers.join(",") : "fresh"}:${data.feedback ? "feedback" : "no-feedback"}`;

  return (
    <QuizForm
      key={formKey}
      lesson={lesson}
      data={data}
      kind={kind}
      hints={kind === "exercise" ? lesson.exercise?.hints ?? [] : []}
      description={kind === "exercise" ? lesson.exercise?.description ?? null : null}
    />
  );
}

type QuizDataLike = NonNullable<LessonDetail["quiz"]> | NonNullable<LessonDetail["exercise"]>;

type FormProps = {
  lesson: LessonDetail;
  data: QuizDataLike;
  kind: "quiz" | "exercise";
  hints: string[];
  description: string | null;
};

function QuizForm({ lesson, data, kind, hints, description }: FormProps) {
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
    <div className="flex flex-col gap-8">
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}

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

      <LessonNotesPanel
        lessonId={lesson.id}
        curriculumId={lesson.module.curriculum.id}
      />
    </div>
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
