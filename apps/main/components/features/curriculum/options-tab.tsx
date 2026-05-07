"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@quazom-ai/ui/components/ui/alert-dialog";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Switch } from "@quazom-ai/ui/components/ui/switch";
import { useTRPC } from "@/trpc/client";

type Props = {
  id: string;
  title: string;
  isHidden: boolean;
};

export function OptionsTab({ id, title, isHidden }: Props) {
  const router = useRouter();
  const trpc = useTRPC();

  // Optimistic local state so the toggle feels snappy. We reconcile against
  // the server on success/error.
  const [hidden, setHidden] = useState(isHidden);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const setHiddenMutation = useMutation(
    trpc.setCurriculumHidden.mutationOptions({
      onSuccess: () => {
        // Refresh so the sidebar list reflects the new visibility.
        router.refresh();
      },
      onError: (error, variables) => {
        // Roll back the optimistic update.
        setHidden(!variables.isHidden);
        toast.error(error.message ?? "Failed to update visibility");
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.deleteCurriculum.mutationOptions({
      onSuccess: () => {
        toast.success(`Deleted "${title}"`);
        setConfirmOpen(false);
        // Send the user somewhere safe; the curriculum they were viewing
        // is gone. router.refresh ensures the sidebar list is up to date too.
        router.push("/curricula");
        router.refresh();
      },
      onError: (error) => {
        toast.error(error.message ?? "Failed to delete curriculum");
      },
    }),
  );

  const handleToggle = (next: boolean) => {
    setHidden(next);
    setHiddenMutation.mutate({ id, isHidden: next });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <Label htmlFor="hide-curriculum" className="text-base font-medium">
              Hide from sidebar
            </Label>
            <p className="text-sm text-muted-foreground">
              Keep this curriculum in your collection but hide it from the
              sidebar list. You can still find it on the Curricula page.
            </p>
          </div>
          <Switch
            id="hide-curriculum"
            checked={hidden}
            onCheckedChange={handleToggle}
            disabled={setHiddenMutation.isPending}
            aria-label="Hide curriculum from sidebar"
            className="cursor-pointer"
          />
        </div>
      </div>

      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium text-foreground">
              Delete curriculum
            </p>
            <p className="text-sm text-muted-foreground">
              Permanently remove this curriculum and all of its modules,
              lessons, and resources. This cannot be undone.
            </p>
          </div>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this curriculum?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;re about to permanently delete{" "}
                  <span className="font-medium text-foreground">
                    &ldquo;{title}&rdquo;
                  </span>
                  . This action cannot be undone — the curriculum, its modules,
                  lessons, and recommended resources will all be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                {/* preventDefault keeps the dialog open during the request so
                    the user sees the loading state, and so we can keep it open
                    on error. We close it ourselves in onSuccess. */}
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    deleteMutation.mutate({ id });
                  }}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete forever"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
