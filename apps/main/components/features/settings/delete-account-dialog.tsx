"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@quazom-ai/ui/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@quazom-ai/ui/components/ui/radio-group";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";

const REASON_OPTIONS = [
  "Don't use the app anymore",
  "Concerned about my data",
  "Switched to another tool",
  "Account was just for testing",
  "Bugs / problems with the app",
  "Other",
] as const;

const CONFIRM_PHRASE = "DELETE";

const schema = z.object({
  reasonChoice: z.enum(REASON_OPTIONS),
  details: z.string().max(1000, "Details are too long").optional().default(""),
  confirmPhrase: z
    .string()
    .refine((v) => v === CONFIRM_PHRASE, {
      message: `Type ${CONFIRM_PHRASE} to confirm`,
    }),
  confirmCheckbox: z.literal(true, {
    message: "Confirm you understand this is permanent",
  }),
});

type FormValues = z.input<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAccountDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <DeleteAccountForm onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [confirmChecked, setConfirmChecked] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reasonChoice: "Don't use the app anymore",
      details: "",
      confirmPhrase: "",
      confirmCheckbox: undefined as unknown as true,
    },
    mode: "onTouched",
  });

  const remove = useMutation(
    trpc.deleteAccount.mutationOptions({
      onSuccess: async () => {
        toast.success("Your account has been deleted.");
        await authClient.signOut().catch(() => undefined);
        router.push("/login");
        router.refresh();
      },
      onError: (err) => toast.error(err.message ?? "Failed to delete account"),
    }),
  );

  const onSubmit = (values: FormValues) => {
    const reason =
      values.details && values.details.trim()
        ? `${values.reasonChoice}: ${values.details.trim()}`
        : values.reasonChoice;
    remove.mutate({ reason });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-destructive">
          Delete your account
        </DialogTitle>
        <DialogDescription>
          This is permanent. All of your curricula, lessons, notes, and study
          schedules will be removed and cannot be recovered. Mind sharing why
          you&apos;re leaving?
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          <FormField
            control={form.control}
            name="reasonChoice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Why are you deleting?</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="gap-2"
                  >
                    {REASON_OPTIONS.map((option) => (
                      <div
                        key={option}
                        className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                      >
                        <RadioGroupItem value={option} id={`delete-${option}`} />
                        <Label
                          htmlFor={`delete-${option}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="details"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Anything else? (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Help us improve…"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPhrase"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type {CONFIRM_PHRASE} to confirm</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder={CONFIRM_PHRASE}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  This confirms you really want to permanently delete your
                  account.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmCheckbox"
            render={({ field, fieldState }) => (
              <FormItem className="flex flex-col gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={confirmChecked}
                    onChange={(e) => {
                      setConfirmChecked(e.target.checked);
                      field.onChange(e.target.checked ? true : undefined);
                    }}
                  />
                  <span>
                    I understand this is permanent and my data cannot be
                    recovered.
                  </span>
                </label>
                {fieldState.error ? (
                  <span className="text-xs text-destructive">
                    {fieldState.error.message}
                  </span>
                ) : null}
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={onClose}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="cursor-pointer"
              disabled={remove.isPending}
            >
              {remove.isPending ? <Spinner /> : "Delete account"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
