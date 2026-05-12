"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quazom-ai/ui/components/ui/select";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { cn } from "@quazom-ai/ui/lib/utils";
import { useTRPC } from "@/trpc/client";
import { ThemePicker } from "@/components/shared/theme-picker";

const formSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(100, "Subject must be less than 100 characters"),
  level: z.enum(["beginner", "intermediate", "advanced"], {
    message: "Level is required",
  }),
  goal: z.string().min(1, { message: "Goal is required" }),
});

type FormValues = z.infer<typeof formSchema>;

// Hand-picked starter topics for new users. Each preset is generated at the
// beginner level so the curriculum is approachable on day one; the goal copy
// is a deliberately generic "comprehensive understanding" template that the
// user can edit before submitting.
const PRESET_TOPICS = [
  "Deep Space Astronomy",
  "Introductory Philosophy",
  "Creative Writing",
  "N5 Japanese",
  "ADHD-Friendly Java Programming",
  "Finance Fundamentals",
] as const;
type PresetTopic = (typeof PRESET_TOPICS)[number];
type PresetChoice = PresetTopic | "custom";

function defaultGoalFor(topic: string): string {
  return `I want to gain a comprehensive understanding of ${topic} so that I can use it in my everyday life`;
}

type Props = {
  /**
   * Advance to the referral survey. Pass the new curriculum's id when one was
   * created so the survey step knows where to land the user when onboarding
   * completes; pass null when the user is skipping.
   */
  onAdvance: (curriculumId: string | null) => void;
};

export function CurriculumStep({ onAdvance }: Props) {
  const trpc = useTRPC();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      level: "beginner",
      goal: "",
    },
  });

  // Initial preset; the user can change this to another preset or "custom".
  // Default to the first preset so the user lands with the form prefilled
  // and can submit immediately if they want to.
  const [preset, setPreset] = useState<PresetChoice>(PRESET_TOPICS[0]);

  // When the preset changes, reset subject + goal accordingly. Switching to
  // "custom" clears both so the user starts from scratch; switching to any
  // other preset fills the topic and resets the goal template (per spec,
  // "Changing the preset resets the goal prefill"). We intentionally
  // overwrite any pending user edits so the prefill behaviour is
  // predictable.
  useEffect(() => {
    if (preset === "custom") {
      form.setValue("subject", "");
      form.setValue("goal", "");
      return;
    }
    form.setValue("subject", preset);
    form.setValue("goal", defaultGoalFor(preset));
  }, [preset, form]);

  const create = useMutation(
    trpc.createCurriculum.mutationOptions({
      onSuccess: (_data, variables) => {
        toast.success("Curriculum is being generated");
        onAdvance(variables.id);
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to start your curriculum");
      },
    }),
  );

  // Presets are locked to beginner regardless of what the (hidden) level
  // field would otherwise carry. Only "custom" surfaces the level picker.
  const isPreset = preset !== "custom";

  const onSubmit = (values: FormValues) => {
    create.mutate({
      ...values,
      level: isPreset ? "beginner" : values.level,
      id: crypto.randomUUID(),
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">
            Pick a starter topic
          </Label>
          <p className="text-xs text-muted-foreground">
            Presets are tuned for beginners. Choose one to prefill the form,
            or pick &quot;Custom topic&quot; to write your own.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_TOPICS.map((topic) => {
              const isSelected = preset === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setPreset(topic)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:bg-muted/40 text-muted-foreground",
                  )}
                >
                  {topic}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPreset("custom")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                preset === "custom"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-dashed border-border bg-card hover:bg-muted/40 text-muted-foreground",
              )}
            >
              Custom topic
            </button>
          </div>
        </div>

        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {isPreset ? "Your topic" : "What do you want to learn?"}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Linear algebra, Spanish, React"
                  autoComplete="off"
                  readOnly={isPreset}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Level is hidden on presets because every preset locks to beginner
            per spec. Custom topics let the user choose. */}
        {isPreset ? null : (
          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>What&apos;s your current level?</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What&apos;s your goal?</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. I want to feel comfortable building a small app from scratch."
                  className="min-h-[110px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2 pt-2">
          <Label className="text-sm font-medium">
            Light Mode or Dark Mode?
          </Label>
          <p className="text-xs text-muted-foreground">
            Pick the look you like best — we&apos;ll fade Quazom into it. You
            can change this any time in Settings.
          </p>
          <ThemePicker idPrefix="onboarding-theme" />
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer"
            onClick={() => onAdvance(null)}
            disabled={create.isPending}
          >
            Skip for now
          </Button>
          <Button
            type="submit"
            className="cursor-pointer"
            disabled={create.isPending}
          >
            {create.isPending ? <Spinner /> : "Create curriculum"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
