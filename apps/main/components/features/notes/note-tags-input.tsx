"use client";

import { useRef, useState } from "react";
import { TagIcon, XIcon } from "lucide-react";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Badge } from "@quazom-ai/ui/components/ui/badge";
import { cn } from "@quazom-ai/ui/lib/utils";
import { NOTE_MAX_TAGS, NOTE_TAG_MAX_LENGTH } from "@/inngest/schemas";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Optional id used to wire the input to a `<Label>`. */
  inputId?: string;
  className?: string;
  /** Render a hint under the input. */
  hint?: string;
};

/**
 * Tag chip input. Accepts comma / Enter to commit a tag, Backspace to
 * remove the last one. Normalises to lower-case, dedupes, and caps the
 * total tags at {@link NOTE_MAX_TAGS}. Free-form chips so users can pick
 * any labels they want.
 */
export function NoteTagsInput({
  value,
  onChange,
  inputId,
  className,
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (tag.length > NOTE_TAG_MAX_LENGTH) return;
    if (value.includes(tag)) return;
    if (value.length >= NOTE_MAX_TAGS) return;
    onChange([...value, tag]);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
        <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
        {value.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 px-1.5 py-0 text-[11px] font-medium"
          >
            <span>{tag}</span>
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="inline-flex cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          id={inputId}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          maxLength={NOTE_TAG_MAX_LENGTH}
          disabled={value.length >= NOTE_MAX_TAGS}
          placeholder={
            value.length >= NOTE_MAX_TAGS
              ? `${NOTE_MAX_TAGS}/${NOTE_MAX_TAGS} — max reached`
              : value.length === 0
                ? "Add a tag…"
                : "Add another…"
          }
          // Reset the input's chrome — the wrapping div is our visible
          // pill row, so the actual input just needs to be invisible.
          className="h-7 flex-1 min-w-[120px] border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {hint ?? "Press Enter or comma to add. Backspace removes the last tag."}
        </span>
        <span className="tabular-nums">
          {value.length}/{NOTE_MAX_TAGS}
        </span>
      </div>
    </div>
  );
}
