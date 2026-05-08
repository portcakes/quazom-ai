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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import {
  RadioGroup,
  RadioGroupItem,
} from "@quazom-ai/ui/components/ui/radio-group";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Textarea } from "@quazom-ai/ui/components/ui/textarea";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";

const REASON_OPTIONS = [
  "Need a break",
  "Too busy / not enough time",
  "Found another tool I prefer",
  "Bugs / problems with the app",
  "Privacy concerns",
  "Other",
] as const;

const schema = z.object({
  reasonChoice: z.enum(REASON_OPTIONS),
  details: z.string().max(1000, "Details are too long").optional().default(""),
  confirm: z.literal(true, {
    message: "Confirm you want to disable",
  }),
});

type FormValues = z.input<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DisableAccountDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <DisableAccountForm onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DisableAccountForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [confirmChecked, setConfirmChecked] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reasonChoice: "Need a break",
      details: "",
      confirm: undefined as unknown as true,
    },
    mode: "onTouched",
  });

  const disable = useMutation(
    trpc.disableAccount.mutationOptions({
      onSuccess: async () => {
        toast.success("Your account has been disabled.");
        // Sessions are deleted server-side; clear the cookie + cached state
        // so the next request lands the user on /login with a clean slate.
        await authClient.signOut().catch(() => undefined);
        router.push("/login");
        router.refresh();
      },
      onError: (err) => toast.error(err.message ?? "Failed to disable account"),
    }),
  );

  const onSubmit = (values: FormValues) => {
    const reason =
      values.details && values.details.trim()
        ? `${values.reasonChoice}: ${values.details.trim()}`
        : values.reasonChoice;
    disable.mutate({ reason });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Disable your account</DialogTitle>
        <DialogDescription>
          We&apos;ll keep your data for when you come back. You can re-enable
          your account by signing back in. Mind sharing why you&apos;re
          stepping away?
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
                <FormLabel>Why are you disabling?</FormLabel>
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
                        <RadioGroupItem
                          value={option}
                          id={`disable-${option}`}
                        />
                        <Label
                          htmlFor={`disable-${option}`}
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
            name="confirm"
            render={({ field, fieldState }) => (
              <FormItem className="flex flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
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
                    I understand my account will be disabled and I&apos;ll be
                    signed out everywhere.
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
              disabled={disable.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={disable.isPending}
            >
              {disable.isPending ? <Spinner /> : "Disable account"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
