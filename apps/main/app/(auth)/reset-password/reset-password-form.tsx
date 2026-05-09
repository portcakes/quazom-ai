"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordForm({
  token,
  initialError,
}: {
  token: string | null;
  initialError: string | null;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onTouched",
  });

  // Better Auth bounces here with `?error=...` (e.g. INVALID_TOKEN) when the
  // user clicks an expired link. Surface that immediately rather than
  // letting them type a password and then telling them.
  if (!token || initialError) {
    return (
      <Card className="p-2">
        <CardHeader>
          <CardTitle className="text-2xl">This link doesn&rsquo;t work</CardTitle>
          <CardDescription>
            Reset links expire after 60 minutes and can only be used once.
            Request a new one and we&rsquo;ll email you another.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Send a new reset link</Link>
          </Button>
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

  const onSubmit = async (values: ResetValues) => {
    setIsSubmitting(true);
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    });
    if (error) {
      toast.error(error.message ?? "Couldn't reset your password.");
      setIsSubmitting(false);
      return;
    }
    toast.success("Password updated. Sign in with your new password.");
    router.push("/login");
  };

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>
          Pick something at least 8 characters long. We&rsquo;ll sign out
          all your other devices for safety.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Must be at least 8 characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : "Set new password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
