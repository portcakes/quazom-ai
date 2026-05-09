"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { cn } from "@quazom-ai/ui/lib/utils";
import {
  joinWaitlist,
  type WaitlistSource,
} from "@/lib/waitlist/actions";

const formSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Please tell us your first name.")
    .max(80, "That name is a little long—try a shorter version."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
});

type FormValues = z.infer<typeof formSchema>;

type Variant = "inline" | "stacked";

type Props = {
  source: WaitlistSource;
  variant?: Variant;
  cta?: string;
  successTitle?: string;
  successBody?: string;
  className?: string;
};

export function WaitlistForm({
  source,
  variant = "inline",
  cta = "Join the waitlist",
  successTitle = "You're on the list!",
  successBody,
  className,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: "", email: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await joinWaitlist({
        firstName: values.firstName,
        email: values.email,
        source,
      });
      if (result.ok) {
        setSubmittedName(values.firstName);
        return;
      }
      if (result.field) {
        setError(result.field, { message: result.error });
      } else {
        setServerError(result.error);
      }
    });
  });

  if (submittedName) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5 text-left",
          className,
        )}
      >
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2Icon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-base font-semibold text-foreground">
            {successTitle}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {successBody ??
              `Thanks, ${submittedName}. We'll email you when your invite is ready—usually within a few weeks.`}
          </p>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <form
        onSubmit={onSubmit}
        noValidate
        className={cn("flex flex-col gap-4", className)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldStacked
            id="waitlist-firstName"
            label="First name"
            error={errors.firstName?.message}
          >
            <Input
              id="waitlist-firstName"
              autoComplete="given-name"
              placeholder="Ada"
              disabled={isPending}
              aria-invalid={errors.firstName ? "true" : undefined}
              {...register("firstName")}
            />
          </FieldStacked>
          <FieldStacked
            id="waitlist-email"
            label="Email"
            error={errors.email?.message}
          >
            <Input
              id="waitlist-email"
              type="email"
              autoComplete="email"
              placeholder="ada@example.com"
              disabled={isPending}
              aria-invalid={errors.email ? "true" : undefined}
              {...register("email")}
            />
          </FieldStacked>
        </div>
        {serverError ? (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="px-5 py-5 text-sm font-medium"
        >
          {isPending ? (
            <>
              <Spinner /> Adding you…
            </>
          ) : (
            <>
              {cta}
              <ArrowRightIcon className="size-4" />
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          We&rsquo;ll only email you about Quazom. Unsubscribe any time.
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn("flex w-full flex-col gap-3", className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <Input
          id="waitlist-inline-firstName"
          autoComplete="given-name"
          placeholder="First name"
          disabled={isPending}
          aria-label="First name"
          aria-invalid={errors.firstName ? "true" : undefined}
          className="h-11 flex-1"
          {...register("firstName")}
        />
        <Input
          id="waitlist-inline-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={isPending}
          aria-label="Email address"
          aria-invalid={errors.email ? "true" : undefined}
          className="h-11 flex-1 sm:flex-[1.4]"
          {...register("email")}
        />
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="h-11 px-5 text-sm font-medium"
        >
          {isPending ? (
            <>
              <Spinner /> Joining…
            </>
          ) : (
            <>
              {cta}
              <ArrowRightIcon className="size-4" />
            </>
          )}
        </Button>
      </div>
      {(errors.firstName || errors.email || serverError) && (
        <p role="alert" className="text-sm text-destructive">
          {errors.firstName?.message ?? errors.email?.message ?? serverError}
        </p>
      )}
    </form>
  );
}

function FieldStacked({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
