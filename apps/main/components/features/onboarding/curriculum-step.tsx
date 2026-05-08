"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@quazom-ai/ui/components/ui/select";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { useTRPC } from "@/trpc/client";

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

  const onSubmit = (values: FormValues) => {
    create.mutate({ ...values, id: crypto.randomUUID() });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What do you want to learn?</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Linear algebra, Spanish, React"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
