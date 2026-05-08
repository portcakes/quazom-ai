// Single source of truth for time-slot definitions. Used by the scheduler,
// calendar, modal, and any other UI that needs to display or sort by slot.

export const STUDY_TIME_SLOTS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as const;
export type StudyTimeSlot = (typeof STUDY_TIME_SLOTS)[number];

type SlotMeta = {
  label: string;
  shortLabel: string;
  range: string;
  // Used to order slots within a day.
  startHour: number;
};

export const STUDY_TIME_SLOT_META: Record<StudyTimeSlot, SlotMeta> = {
  MORNING: {
    label: "Morning",
    shortLabel: "AM",
    range: "8 AM – 12 PM",
    startHour: 8,
  },
  AFTERNOON: {
    label: "Afternoon",
    shortLabel: "PM",
    range: "12 PM – 5 PM",
    startHour: 12,
  },
  EVENING: {
    label: "Evening",
    shortLabel: "Eve",
    range: "5 PM – 9 PM",
    startHour: 17,
  },
  NIGHT: {
    label: "Night",
    shortLabel: "Night",
    range: "9 PM – 12 AM",
    startHour: 21,
  },
};

// Days of the week, indexed to match JS `Date#getDay()` (0 = Sunday).
export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]["value"];

export function isDayOfWeek(n: number): n is DayOfWeek {
  return Number.isInteger(n) && n >= 0 && n <= 6;
}

export function compareTimeSlots(a: StudyTimeSlot, b: StudyTimeSlot): number {
  return STUDY_TIME_SLOT_META[a].startHour - STUDY_TIME_SLOT_META[b].startHour;
}
