"use client";

import { Checkbox } from "@quazom-ai/ui/components/ui/checkbox";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import type { SandboxSourceSummary } from "@/lib/queries/sandbox";

const KIND_LABEL: Record<SandboxSourceSummary["kind"], string> = {
  TOPIC: "Topic",
  LINK_RESOURCE: "Link",
  FILE_RESOURCE: "File",
  CONTINUITY_NOTE: "Note",
  THESIS: "Thesis",
  QUESTION: "Question",
};

type Props = {
  sources: SandboxSourceSummary[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

export function SandboxSourcePicker({ sources, selected, onToggle }: Props) {
  if (sources.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        This sandbox has no sources yet. The AI will answer from general
        knowledge until you add some.
      </p>
    );
  }
  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-background p-1">
      {sources.map((source) => {
        const checked = selected.has(source.id);
        return (
          <li key={source.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(source.id)}
              />
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {KIND_LABEL[source.kind]}
              </Badge>
              <span className="truncate">{source.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
