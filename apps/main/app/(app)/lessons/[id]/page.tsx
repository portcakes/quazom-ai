import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { getLessonById } from "@/lib/queries/lesson";
import { LessonHero } from "@/components/features/lesson/lesson-hero";
import { LessonPending } from "@/components/features/lesson/lesson-pending";
import { QuizView } from "@/components/features/lesson/quiz-view";
import { ReadingView } from "@/components/features/lesson/reading-view";
import { VideoView } from "@/components/features/lesson/video-view";
import { ProjectView } from "@/components/features/lesson/project-view";
import { DiscussionView } from "@/components/features/lesson/discussion-view";

type Params = Promise<{ id: string }>;

export default async function LessonPage({ params }: { params: Params }) {
  const session = await requireAuth();
  const { id } = await params;

  const lesson = await getLessonById(id);

  if (!lesson) {
    notFound();
  }

  // STUB / GENERATING / FAILED → render the pending state, which polls until
  // it flips to READY (or we time out).
  if (lesson.status !== "READY") {
    return (
      <div className="flex min-w-0 flex-col">
        <LessonHero lesson={lesson} />
        <section className="mx-auto w-full max-w-4xl px-6 py-8">
          <LessonPending id={lesson.id} title={lesson.title} status={lesson.status} />
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <LessonHero lesson={lesson} />
      <section className="mx-auto w-full max-w-4xl px-6 py-8">
        <LessonBody lesson={lesson} userId={session.user.id} />
      </section>
    </div>
  );
}

function LessonBody({
  lesson,
  userId,
}: {
  lesson: NonNullable<Awaited<ReturnType<typeof getLessonById>>>;
  userId: string;
}) {
  switch (lesson.activityType) {
    case "QUIZ":
      return <QuizView lesson={lesson} kind="quiz" />;
    case "EXERCISE":
      return <QuizView lesson={lesson} kind="exercise" />;
    case "READING":
    case "OTHER":
      return <ReadingView lesson={lesson} />;
    case "VIDEO":
      return <VideoView lesson={lesson} />;
    case "PROJECT":
      return <ProjectView lesson={lesson} />;
    case "DISCUSSION":
      return <DiscussionView lesson={lesson} userId={userId} />;
    default:
      return <ReadingView lesson={lesson} />;
  }
}
