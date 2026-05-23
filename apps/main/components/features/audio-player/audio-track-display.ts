/**
 * Shared display helpers for the audio player surfaces (the persistent
 * <AudioPlayerBar /> and the inline <AudioLibrarySection /> on /resources).
 * Kept framework-agnostic — no React imports — so any surface can pull
 * just the formatters without dragging client-only dependencies in.
 */

/** Pretty-print a duration in `m:ss`. Returns "0:00" for nullish/zero. */
export function formatSeconds(secs: number | null | undefined): string {
  if (!secs || !Number.isFinite(secs) || secs <= 0) return "0:00";
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Map an `AudioSourceKind` enum value to the label we surface in the UI. */
export function sourceKindLabel(kind: string): string {
  switch (kind) {
    case "LESSON_OVERVIEW":
      return "Lesson overview";
    case "LESSON_READING":
      return "Lesson reading";
    case "LESSON_VIDEO_OVERVIEW":
      return "Video overview";
    case "LESSON_QUIZ_OVERVIEW":
      return "Assessment overview";
    case "LESSON_QUIZ_READING":
      return "Assessment reading";
    case "RESOURCE_READER":
      return "Resource";
    case "CURRICULUM_OVERVIEW":
      return "Curriculum overview";
    case "COURSE_OBJECTIVES":
      return "Course objectives";
    default:
      return "Audio";
  }
}
