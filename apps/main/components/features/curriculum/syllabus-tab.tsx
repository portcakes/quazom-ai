"use client";

import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { Separator } from "@quazom-ai/ui/components/ui/separator";
import type {
  CurriculumObjective,
  CurriculumResource,
} from "@/inngest/schemas";

type Props = {
  objectives: CurriculumObjective[];
  resources: CurriculumResource[];
};

export function SyllabusTab({ objectives, resources }: Props) {
  const orderedObjectives = [...objectives].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <header>
          <h2 className="font-heading text-2xl font-semibold">Course Objectives</h2>
          <p className="text-sm text-muted-foreground">
            What you&apos;ll be able to do by the end of this curriculum.
          </p>
        </header>
        {orderedObjectives.length === 0 ? (
          <p className="text-sm text-muted-foreground">No objectives listed.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {orderedObjectives.map((objective) => (
              <li
                key={`${objective.order}-${objective.title}`}
                className="flex gap-4 rounded-lg border border-border bg-card p-4"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-medium text-muted-foreground">
                  {objective.order}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium leading-snug">{objective.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {objective.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <header>
          <h2 className="font-heading text-2xl font-semibold">Recommended Reading & Resources</h2>
          <p className="text-sm text-muted-foreground">
            Quick reference list. Full details are on the Resources tab.
          </p>
        </header>
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resources listed.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {resources.map((resource) => (
              <li
                key={`${resource.type}-${resource.title}`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="truncate text-sm font-medium">{resource.title}</span>
                <Badge variant="secondary" className="capitalize shrink-0">
                  {resource.type}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
