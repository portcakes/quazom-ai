"use client";

import Link from "next/link";
import {
  BookIcon,
  FlaskConicalIcon,
  LayersIcon,
  LayoutGridIcon,
  Loader2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { useSidebar } from "@quazom-ai/ui/components/ui/sidebar";
import { useCourseList } from "./course-list-provider";
import NewStudiesModal from "../new-curriculum-modal";

export function CourseList() {
  const { courses, sandboxes, pending, totalCount } = useCourseList();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleCourseClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Empty state only when there's truly nothing — not even hidden studies
  // or pending generations.
  if (
    courses.length === 0 &&
    sandboxes.length === 0 &&
    pending.length === 0 &&
    totalCount === 0
  ) {
    return <CoursesEmptyState />;
  }

  return (
    <ul className="flex flex-col gap-2">
      <li>
        <NewStudiesModal />
      </li>
      {courses.map((course) => (
        course.kind === "CONTINUITY" ? (
          <li key={course.id}>
          <Link
            href={`/curricula/${course.id}`}
            onClick={handleCourseClick}
            className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:ring-yellow-500/10 hover:border-yellow-500/10 hover:text-yellow-700 dark:hover:text-yellow-300"
          >
            <LayersIcon
              className="size-4 shrink-0 text-yellow-600"
              aria-label="Continuity Curriculum"
            />
            <span className="truncate">{course.name}</span>
          </Link>
        </li>
      ) : (
        <li key={course.id}>
          <Link
            href={`/curricula/${course.id}`}
            onClick={handleCourseClick}
            className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {/* Status decorations override the default book icon — a tiny
                spinner for in-flight rows, a warning for failed ones, and a
                stacked-layers glyph for continuity curricula. */}
            {course.status === "PENDING" ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : course.status === "FAILED" ? (
              <AlertTriangleIcon className="size-4 shrink-0 text-destructive" />
            ) : (
              <BookIcon className="size-4 shrink-0" />
            )}
            <span className="truncate">{course.name}</span>
          </Link>
        </li>
      )))}
      {pending.map((entry) => (
        <li key={entry.tempId}>
          <div
            aria-disabled="true"
            aria-busy="true"
            className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 opacity-70 cursor-not-allowed"
          >
            <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            <span className="flex flex-col min-w-0">
              <span className="truncate text-muted-foreground">Generating...</span>
              <span className="truncate text-xs text-muted-foreground/80">
                {entry.subject}
              </span>
            </span>
          </div>
        </li>
      ))}
      {sandboxes.map((sandbox) => (
        <li key={sandbox.id}>
          <Link
            href={`/sandboxes/${sandbox.id}`}
            onClick={handleCourseClick}
            className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:text-orange-700 dark:hover:text-orange-300"
          >
            <FlaskConicalIcon
              className="size-4 shrink-0 text-orange-600"
              aria-label="Knowledge Sandbox"
            />
            <span className="truncate">{sandbox.title}</span>
          </Link>
        </li>
      ))}
      {totalCount > 0 && (
        <li className="mt-1">
          <Link
            href="/studies"
            onClick={handleCourseClick}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LayoutGridIcon className="size-4 shrink-0" />
            <span className="truncate">See all Studies</span>
          </Link>
        </li>
      )}
    </ul>
  );
}

function CoursesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sidebar-border bg-card/50 p-4 text-center">
      <p className="text-sm text-muted-foreground">
        You don&apos;t have any studies yet. Create one to get started.
      </p>
      <NewStudiesModal />
    </div>
  );
}
