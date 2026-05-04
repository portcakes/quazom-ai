import "server-only";

// import { headers } from "next/headers";
// import { auth } from "@/lib/auth";
// import prisma from "@/lib/db";

export type CourseSummary = {
  id: string;
  name: string;
};

// TODO: replace the hard-coded stub below once a Course model is added to
// schema.prisma. The id used here will be the URL segment for the course
// page at `/courses/[courseId]`, and access should be scoped to the
// authenticated user (e.g. `where: { userId: session.user.id }`).
//
// export async function getUserCourses(): Promise<CourseSummary[]> {
//   const session = await auth.api.getSession({ headers: await headers() });
//   if (!session) return [];
//
//   return prisma.course.findMany({
//     where: { userId: session.user.id },
//     select: { id: true, name: true },
//     orderBy: { createdAt: "asc" },
//   });
// }

export async function getUserCourses(): Promise<CourseSummary[]> {
  return [
    { id: "physics-i", name: "Physics I" },
    { id: "history-of-modern-media", name: "History of Modern Media" },
    { id: "deep-space-astronomy", name: "Deep Space Astronomy" },
  ];
}
