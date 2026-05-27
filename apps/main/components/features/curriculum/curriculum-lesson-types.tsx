"use client";

import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@quazom-ai/ui/components/ui/popover";
import { ListFilterIcon } from "lucide-react";
import { lessonActivityTypes, type LessonActivityType } from "@/inngest/schemas";

// Human-friendly labels for each AI-facing lesson type. Kept separate from
// the AI schema so we can tune the wording for UI surfaces without touching
// the prompt-time enum names.
export const LESSON_TYPE_LABELS: Record<LessonActivityType, string> = {
  reading: "Readings",
  quiz: "Quizzes",
  exercise: "Exercises",
  practice: "Practice",
  project: "Projects",
  discussion: "Discussions",
  video: "Videos",
  other: "Other",
};

// Lesson types the user is allowed to opt into when creating a new
// curriculum. We exclude:
//   - `practice` — collapses into EXERCISE on persist (see
//     `activityTypeToDb`), so exposing it as a separate checkbox would be
//     a duplicate.
//   - `video` — retired in May 2026. The AI cannot reliably embed real
//     videos, so the "video" activity type degraded into a YouTube-search
//     placeholder that felt like filler. Existing curricula that already
//     have VIDEO lessons keep working (the per-lesson UI and Inngest
//     content generation are unchanged); only new curricula are blocked
//     from opting in. The tRPC normaliser also strips VIDEO out of new
//     `includedActivityTypes` for defence in depth.
export const VISIBLE_LESSON_TYPES: LessonActivityType[] = lessonActivityTypes.filter(
  (t) => t !== "practice" && t !== "video",
) as LessonActivityType[];

// Multi-select dropdown that drives the curriculum-creation lesson-type
// filter. Caller owns the `Set<LessonActivityType>` state. The trigger
// shows a short summary ("All lesson types" / "3 lesson types") so the
// surrounding form stays compact.
export function LessonTypeFilter({
  selected,
  setSelected,
  label,
}: {
  selected: Set<LessonActivityType>;
  setSelected: React.Dispatch<React.SetStateAction<Set<LessonActivityType>>>;
  /** Optional override for the trigger label when no selection is active.
   * Defaults to "All lesson types" / "N lesson types". */
  label?: string;
}) {
  const toggle = (type: LessonActivityType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };
  const trigger =
    label ??
    (selected.size === VISIBLE_LESSON_TYPES.length
      ? "All lesson types"
      : selected.size === 0
        ? "No lesson types selected"
        : `${selected.size} lesson type${selected.size === 1 ? "" : "s"}`);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ListFilterIcon className="mr-2 size-4" />
          {trigger}
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
