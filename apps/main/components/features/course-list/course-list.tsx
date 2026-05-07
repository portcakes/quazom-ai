"use client";

import Link from "next/link";
import { BookIcon, Loader2Icon } from "lucide-react";
import { useSidebar } from "@quazom-ai/ui/components/ui/sidebar";
import { useCourseList } from "./course-list-provider";
import NewCurriculumModal from "../new-curriculum-modal";

export function CourseList() {
  const { courses, pending } = useCourseList();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleCourseClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (courses.length === 0 && pending.length === 0) {
    return <CoursesEmptyState />;
  }

  return (
    <ul className="flex flex-col gap-2">
      <li>
        <NewCurriculumModal />
      </li>
      {courses.map((course) => (
        <li key={course.id}>
          <Link
            href={`/curricula/${course.id}`}
            onClick={handleCourseClick}
            className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <BookIcon className="size-4 shrink-0" />
            <span className="truncate">{course.name}</span>
          </Link>
        </li>
      ))}
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
    </ul>
  );
}

function CoursesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-sidebar-border bg-card/50 p-4 text-center">
      <p className="text-sm text-muted-foreground">
        You don&apos;t have any courses yet. Create one to get started.
      </p>
      <NewCurriculumModal />
    </div>
  );
}
