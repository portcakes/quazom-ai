"use client";

import type { CurriculumModuleWithLessons } from "@/lib/queries/lesson";
import { ModuleCard } from "./module-card";

type Props = {
  modules: CurriculumModuleWithLessons[];
};

export function ModulesTab({ modules }: Props) {
  if (modules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No modules listed yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {modules.map((module, index) => (
        <li key={module.id} className="min-w-0">
          <ModuleCard module={module} index={index} />
        </li>
      ))}
    </ul>
  );
}
