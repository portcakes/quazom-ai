"use client";

import { ScrollArea } from "@quazom-ai/ui/components/ui/scroll-area";
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
    <ScrollArea className="max-h-[70vh] pr-3 mb-4">
      <ul className="flex flex-col gap-3">
        {modules.map((module, index) => (
          <li key={`${index}-${module.title}`}>
            <ModuleCard module={module} index={index} />
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
