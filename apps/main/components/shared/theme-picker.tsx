"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Label } from "@quazom-ai/ui/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@quazom-ai/ui/components/ui/radio-group";
import { Skeleton } from "@quazom-ai/ui/components/ui/skeleton";
import { cn } from "@quazom-ai/ui/lib/utils";
import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react";

const OPTIONS = [
  {
    id: "light",
    label: "Light",
    description: "Always show the warm, paper-coloured UI.",
    Icon: SunIcon,
  },
  {
    id: "dark",
    label: "Dark",
    description: "Always show the deep, low-glare UI.",
    Icon: MoonIcon,
  },
  {
    id: "system",
    label: "Use system settings",
    description: "Follow your OS theme automatically.",
    Icon: MonitorIcon,
  },
] as const;

type Props = {
  /**
   * Override the radio-group `name` so multiple pickers (e.g. settings + an
   * onboarding step on a stale tab) don't share keyboard focus.
   */
  name?: string;
  /** Optional id prefix for ARIA wiring. */
  idPrefix?: string;
};

/**
 * Light / Dark / System picker backed by `next-themes`. Behaviour:
 *   - Reads the user's current preference (light | dark | system) and
 *     reflects it as the selected radio.
 *   - Writing a new value updates `next-themes`, which adds/removes the
 *     `.dark` class on `<html>`. Our CSS handles the cross-fade.
 *   - SSR returns a skeleton because the theme value is only known on the
 *     client — without this we'd hydration-mismatch on the radio's
 *     `aria-checked` attribute.
 */
export function ThemePicker({ name = "theme", idPrefix = "theme" }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-2">
        {OPTIONS.map((opt) => (
          <Skeleton key={opt.id} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <RadioGroup
      name={name}
      value={theme ?? "system"}
      onValueChange={(value) => setTheme(value)}
      className="flex flex-col gap-2"
    >
      {OPTIONS.map(({ id, label, description, Icon }) => {
        const inputId = `${idPrefix}-${id}`;
        const isSelected = (theme ?? "system") === id;
        return (
          <Label
            key={id}
            htmlFor={inputId}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/40",
            )}
          >
            <RadioGroupItem id={inputId} value={id} className="mt-1" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4" />
                <span>{label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
