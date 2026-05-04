import Link from "next/link";
import { BookIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@quazom-ai/ui/components/ui/sidebar";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { getCurrentUser } from "@/lib/queries/user";
import { getUserCourses, type CourseSummary } from "@/lib/queries/courses";
import { UserMenu } from "./user-menu";

export default async function AppSidebar() {
  const user = await getCurrentUser();
  const courses = await getUserCourses();

  return (
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader className="px-4 py-4">
        <Link
          href="/"
          className="font-heading text-2xl font-bold tracking-tight hover:text-sidebar-accent-foreground"
        >
          Quazom
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent className="px-3 py-3">
        {courses.length === 0 ? (
          <CoursesEmptyState />
        ) : (
          <CourseList courses={courses} />
        )}
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      <SidebarFooter className="p-0">
        <UserMenu
          firstName={user.firstName}
          fullName={user.fullName}
          avatarUrl={user.avatarUrl}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

function CourseList({ courses }: { courses: CourseSummary[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {courses.map((course) => (
        <li key={course.id}>
          <Link
            href={`/courses/${course.id}`}
            className="flex w-full items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <BookIcon className="size-4 shrink-0" />
            <span className="truncate">{course.name}</span>
          </Link>
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
      <Button asChild size="sm">
        <Link href="/courses/new">Create Course</Link>
      </Button>
    </div>
  );
}
