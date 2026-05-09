"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quazom-ai/ui/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

const forgotSchema = z.object({
  email: z.email("Please enter a valid email address."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  // We always show the same success card regardless of whether the email
  // exists in our system. Better Auth's `requestPasswordReset` is built to
  // be safe to call this way (constant response, dummy operations on
  // unknown emails), and it keeps us from leaking which addresses are
  // registered.
  const onSubmit = async (values: ForgotValues) => {
    setIsSubmitting(true);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: `${origin}/reset-password`,
    });
    setSubmittedEmail(values.email);
    setIsSubmitting(false);
  };

  if (submittedEmail) {
    return (
      <Card className="p-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <CheckCircle2Icon className="size-6 text-primary" />
            Check your email
          </CardTitle>
          <CardDescription>
            If an account exists for {submittedEmail}, we just sent a reset
            link to it. The link expires in 60 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Didn&rsquo;t get the email? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setSubmittedEmail(null)}
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              try a different address
            </button>
            .
          </p>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          Enter the email you signed up with and we&rsquo;ll send you a
          link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : "Send reset link"}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Back to{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
