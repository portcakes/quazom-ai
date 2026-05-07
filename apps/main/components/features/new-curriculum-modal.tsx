"use client";

import { Button } from "@quazom-ai/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@quazom-ai/ui/components/ui/dialog";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@quazom-ai/ui/components/ui/select";
import { Form, FormItem, FormLabel, FormControl, FormField, FormMessage } from "@quazom-ai/ui/components/ui/form";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { useCourseList } from "./course-list/course-list-provider";

const formSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(100, "Subject must be less than 100 characters"),
  level: z.enum(["beginner", "intermediate", "advanced"], {
    message: "Level is required",
  }),
  goal: z.string().min(1, {
    message: "Goal is required",
  }),
});

type FormValues = z.infer<typeof formSchema>;

const NewCurriculumModal = () => {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const router = useRouter();
  const { addPending } = useCourseList();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      level: "beginner",
      goal: "",
    },
  });

  const { mutate: createCurriculum, isPending } = useMutation(
    trpc.createCurriculum.mutationOptions({
      onSuccess: (_data, variables) => {
        addPending({ tempId: variables.id, subject: variables.subject });
        toast.success("Curriculum creation started");
        form.reset();
        setOpen(false);
        router.push(`/curricula/${variables.id}`);
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to create curriculum");
      },
    }),
  );

  const onSubmit = (values: FormValues) => {
    createCurriculum({ ...values, id: crypto.randomUUID() });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center cursor-pointer hover:bg-sidebar-accent rounded-md p-2">
            <PlusIcon className="size-4 mr-2" />
            <span className="text-sm font-medium text-foreground">New Curriculum</span>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Curriculum</DialogTitle>
          <DialogDescription>
            Create a new curriculum for a given topic.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Enter a subject" {...field} />
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
                  <FormLabel>Level</FormLabel>
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
                  <FormLabel>Goal</FormLabel>
                  <FormControl>
                    <Textarea placeholder="My goal is to..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default NewCurriculumModal;
