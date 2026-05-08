import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import type { LessonDetail } from "@/lib/queries/lesson";

type Props = {
  lesson: Pick<
    LessonDetail,
    "title" | "summary" | "duration" | "activityType" | "module"
  >;
};

export function LessonHero({ lesson }: Props) {
  return (
    <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-10">
        <Link
          href={`/curricula/${lesson.module.curriculum.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span className="truncate">{lesson.module.curriculum.title}</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="truncate">{lesson.module.title}</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {lesson.activityType.toLowerCase()}
          </Badge>
          {lesson.duration ? (
            <Badge variant="outline">{lesson.duration}</Badge>
          ) : null}
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {lesson.title}
        </h1>
        {lesson.summary ? (
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {lesson.summary}
          </p>
        ) : null}
      </div>
    </section>
  );
}
