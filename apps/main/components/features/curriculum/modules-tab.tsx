"use client";

import type { CurriculumModule } from "@/inngest/schemas";
import { ModuleCard } from "./module-card";

type Props = {
  modules: CurriculumModule[];
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
        <li key={`${index}-${module.title}`} className="min-w-0">
          <ModuleCard module={module} index={index} />
        </li>
      ))}
    </ul>
  );
}
