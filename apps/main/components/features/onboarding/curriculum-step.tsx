"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quazom-ai/ui/components/ui/select";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { cn } from "@quazom-ai/ui/lib/utils";
import { LayersIcon, SlidersIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { ThemePicker } from "@/components/shared/theme-picker";
import {
  SourcesEditor,
  partitionSourcesForMutation,
  type Source,
} from "@/components/features/curriculum/curriculum-sources";
import {
  LessonTypeFilter,
  VISIBLE_LESSON_TYPES,
} from "@/components/features/curriculum/curriculum-lesson-types";
import type { LessonActivityType } from "@/inngest/schemas";

// ---------------------------------------------------------------------------
// Onboarding-only constants
// ---------------------------------------------------------------------------

// Hand-picked starter topics for new users. Each preset is generated at the
// beginner level so the curriculum is approachable on day one; the goal copy
// is a deliberately generic "comprehensive understanding" template that the
// user can edit before submitting.
const PRESET_TOPICS = [
  "Deep Space Astronomy",
  "Introductory Philosophy",
  "Creative Writing",
  "N5 Japanese",
  "ADHD-Friendly Java Programming",
  "Finance Fundamentals",
] as const;
type PresetTopic = (typeof PRESET_TOPICS)[number];
type PresetChoice = PresetTopic | "custom";

type Level = "beginner" | "intermediate" | "advanced";
type Mode = "quick" | "advanced";

function defaultGoalFor(topic: string): string {
  return `I want to gain a comprehensive understanding of ${topic} so that I can use it in my everyday life`;
}

type Props = {
  /**
   * Advance to the referral survey. Pass the new curriculum's id when one was
   * created so the survey step knows where to land the user when onboarding
   * completes; pass null when the user is skipping.
   */
  onAdvance: (curriculumId: string | null) => void;
};

// ---------------------------------------------------------------------------
// CurriculumStep — first onboarding screen. Lets the user pick between Quick
// Setup (presets + optional single source) and Advanced Setup (full sources
// picker + lesson-type filter; thesis is intentionally omitted from the
// onboarding flow even when ≥2 sources push the form into continuity mode).
// ---------------------------------------------------------------------------

export function CurriculumStep({ onAdvance }: Props) {
  const trpc = useTRPC();

  const [mode, setMode] = useState<Mode>("quick");

  // Initial preset; the user can change this to another preset or "custom".
  // Default to the first preset so the user lands with the form prefilled
  // and can submit immediately if they want to.
  const [preset, setPreset] = useState<PresetChoice>(PRESET_TOPICS[0]);

  const [subject, setSubject] = useState<string>(PRESET_TOPICS[0]);
  const [level, setLevel] = useState<Level>("beginner");
  const [goal, setGoal] = useState<string>(defaultGoalFor(PRESET_TOPICS[0]));
  const [sources, setSources] = useState<Source[]>([]);
  const [includedTypes, setIncludedTypes] = useState<Set<LessonActivityType>>(
    () => new Set(VISIBLE_LESSON_TYPES),
  );

  // Auto-grow the Goal textarea so a long goal stays fully visible without
  // an inner scrollbar — same trick as the New Curriculum modal.
  const goalRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = goalRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [goal]);

  // Preset / mode change handlers — these update other form fields as a
  // side-effect of the user's click, instead of via `useEffect`, to avoid
  // cascading renders flagged by `react-hooks/set-state-in-effect`.
  const handlePresetChange = (next: PresetChoice) => {
    setPreset(next);
    // Switching to "custom" clears both so the user starts from scratch;
    // switching to any other preset fills the topic and resets the goal
    // template (per spec, "Changing the preset resets the goal prefill").
    // We intentionally overwrite any pending user edits so the prefill
    // behaviour is predictable.
    if (next === "custom") {
      setSubject("");
      setGoal("");
    } else {
      setSubject(next);
      setGoal(defaultGoalFor(next));
    }
  };
  const handleModeChange = (next: Mode) => {
    setMode(next);
    // Going Advanced → Quick should not leak >1 sources into a
    // single-source submission. Keep the first attached source so the user
    // doesn't lose their just-uploaded file.
    if (next === "quick" && sources.length > 1) {
      setSources((prev) => prev.slice(0, 1));
    }
  };

  // Presets are locked to beginner per spec. Only "custom" surfaces the
  // level picker in Quick mode; Advanced mode always exposes it.
  const isPreset = preset !== "custom";
  const showLevelPicker = mode === "advanced" || !isPreset;

  const sourceCount = sources.length;
  // Advanced mode flips into Continuity submission once ≥2 sources are
  // attached. Onboarding intentionally omits the thesis editor — the user
  // can add one later from the curriculum detail page.
  const isContinuity = mode === "advanced" && sourceCount >= 2;

  // ---- Mutations ----
  const createSingle = useMutation(
    trpc.createCurriculum.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success("Curriculum is being generated");
        onAdvance(variables.id);
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to start your curriculum");
      },
    }),
  );
  const createContinuity = useMutation(
    trpc.createContinuityCurriculum.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success("Continuity Curriculum is being generated");
        onAdvance(variables.id);
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to start your curriculum");
      },
    }),
  );
  const submitting = createSingle.isPending || createContinuity.isPending;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    const hasSubject = subject.trim().length > 0;
    // Subject-or-source is required for both modes — never generate from
    // literally nothing.
    if (sourceCount === 0 && !hasSubject) return false;
    if (mode === "advanced" && includedTypes.size === 0) return false;
    return true;
  }, [submitting, subject, sourceCount, mode, includedTypes.size]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const id = crypto.randomUUID();
    const { resourceIds, extraTopics } = partitionSourcesForMutation(sources);
    // Presets lock to beginner regardless of any stale level state.
    const effectiveLevel = mode === "quick" && isPreset ? "beginner" : level;

    if (isContinuity) {
      createContinuity.mutate({
        id,
        subject: subject.trim(),
        level: effectiveLevel,
        goal: goal.trim(),
        // Onboarding spec: no thesis option for multi-source curricula here.
        thesis: "",
        resourceIds,
        extraTopics,
        continuityNoteIds: [],
        includedActivityTypes: Array.from(includedTypes),
      });
    } else {
      createSingle.mutate({
        id,
        subject: subject.trim(),
        level: effectiveLevel,
        goal: goal.trim(),
        resourceIds,
        extraTopics,
        // Only forward an explicit filter when the user customised it in
        // Advanced mode; Quick mode keeps the server default (all types).
        includedActivityTypes:
          mode === "advanced" ? Array.from(includedTypes) : undefined,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <ModeToggle mode={mode} setMode={handleModeChange} />

      {mode === "quick" ? (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Pick a starter topic</Label>
          <p className="text-xs text-muted-foreground">
            Presets are tuned for beginners. Choose one to prefill the form,
            or pick &quot;Custom topic&quot; to write your own.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_TOPICS.map((topic) => {
              const isSelected = preset === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handlePresetChange(topic)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:bg-muted/40 text-muted-foreground",
                  )}
                >
                  {topic}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handlePresetChange("custom")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                preset === "custom"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-dashed border-border bg-card hover:bg-muted/40 text-muted-foreground",
              )}
            >
              Custom topic
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="onboarding-subject">
          {mode === "quick"
            ? isPreset
              ? "Your topic"
              : "What do you want to learn?"
            : `Subject${sourceCount > 0 ? " (optional)" : ""}`}
        </Label>
        <Input
          id="onboarding-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Linear algebra, Spanish, React"
          autoComplete="off"
          readOnly={mode === "quick" && isPreset}
        />
        {mode === "advanced" && sourceCount > 0 && !subject.trim() ? (
          <p className="text-xs text-muted-foreground">
            Leave blank to let your sources set the topic.
          </p>
        ) : null}
      </div>

      {showLevelPicker ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-level">
            {mode === "quick"
              ? "What's your current level?"
              : "Level"}
          </Label>
          <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
            <SelectTrigger id="onboarding-level">
              <SelectValue placeholder="Select a level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="onboarding-goal">
          {mode === "advanced" ? "Goal (optional)" : "What's your goal?"}
        </Label>
        <Textarea
          id="onboarding-goal"
          ref={goalRef}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. I want to feel comfortable building a small app from scratch."
          className="min-h-[110px] resize-none overflow-hidden leading-relaxed"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          {mode === "quick"
            ? "Add a source (optional)"
            : "Sources"}
        </Label>
        <p className="text-xs text-muted-foreground">
          {mode === "quick"
            ? "Optionally attach one link or upload a PDF / TXT / Markdown file to seed your curriculum."
            : "Attach links, uploads, and extra topics. Two or more sources creates a Continuity Curriculum."}
        </p>
        <SourcesEditor
          sources={sources}
          setSources={setSources}
          maxSources={mode === "quick" ? 1 : 6}
          allowTopics={mode === "advanced"}
        />
        {mode === "advanced" && sourceCount >= 2 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LayersIcon className="size-3.5" />
            This will be created as a Continuity Curriculum.
          </p>
        ) : null}
      </div>

      {mode === "advanced" ? (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Lesson types</Label>
          <p className="text-xs text-muted-foreground">
            Pick which kinds of lessons your curriculum should include.
          </p>
          <div>
            <LessonTypeFilter
              selected={includedTypes}
              setSelected={setIncludedTypes}
            />
          </div>
          {includedTypes.size === 0 ? (
            <p className="text-xs text-destructive">
              Select at least one lesson type.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 pt-2">
        <Label className="text-sm font-medium">
          Light Mode or Dark Mode?
        </Label>
        <p className="text-xs text-muted-foreground">
          Pick the look you like best — we&apos;ll fade Quazom into it. You
          can change this any time in Settings.
        </p>
        <ThemePicker idPrefix="onboarding-theme" />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="cursor-pointer"
          onClick={() => onAdvance(null)}
          disabled={submitting}
        >
          Skip for now
        </Button>
        <Button
          type="submit"
          className="cursor-pointer"
          disabled={!canSubmit}
        >
          {submitting ? (
            <Spinner />
          ) : isContinuity ? (
            "Create Continuity Curriculum"
          ) : (
            "Create curriculum"
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ModeToggle — a two-button segmented control matching the preset-chip
// styling so the surface stays visually cohesive with the rest of the step.
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Curriculum setup mode"
      className="inline-flex rounded-full border border-border bg-card p-1 self-start"
    >
      <ModeTabButton
        active={mode === "quick"}
        onClick={() => setMode("quick")}
        label="Quick Setup"
        icon={<SlidersIcon className="size-3.5" />}
      />
      <ModeTabButton
        active={mode === "advanced"}
        onClick={() => setMode("advanced")}
        label="Advanced Setup"
        icon={<LayersIcon className="size-3.5" />}
      />
    </div>
  );
}

function ModeTabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
