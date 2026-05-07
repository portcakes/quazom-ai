import Link from "next/link";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { ClockIcon } from "lucide-react";
import type { CurriculumCardSummary } from "@/lib/queries/courses";

type Props = {
  curriculum: CurriculumCardSummary;
};

export function CurriculumCollectionCard({ curriculum }: Props) {
  return (
    <Link
      href={`/curricula/${curriculum.id}`}
      className="group flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 ring-1 ring-transparent transition-colors hover:border-foreground/20 hover:ring-foreground/10 focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {curriculum.level}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <ClockIcon className="size-3" />
          {curriculum.estimatedDuration}
        </Badge>
      </div>
      <h3 className="font-heading text-xl font-semibold leading-tight tracking-tight text-foreground group-hover:text-foreground">
        {curriculum.title}
      </h3>
      <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
        {curriculum.overview}
      </p>
    </Link>
  );
}
