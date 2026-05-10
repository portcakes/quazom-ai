"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { LockIcon } from "lucide-react";
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

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

const REASON_TOASTS: Record<string, { kind: "error" | "info"; message: string }> = {
  forbidden: {
    kind: "error",
    message:
      "That account isn't an admin. Ask an existing admin to flip your isAdmin flag.",
  },
  unknown: {
    kind: "error",
    message: "Your session is stale. Sign in again to continue.",
  },
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  });

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (!reason) return;
    const t = REASON_TOASTS[reason];
    if (!t) return;
    if (t.kind === "error") toast.error(t.message);
    else toast.info(t.message);
    // Run once per mount; subsequent reason changes are extremely rare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
    toast.info("Signed out.");
  };

  const onSubmit = async (values: LoginValues) => {
    setIsSubmitting(true);

    await authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
        callbackURL: "/",
      },
      {
        onSuccess: () => {
          toast.success("Welcome back, admin.");
          router.push("/");
          router.refresh();
        },
        onError: (error) => {
          toast.error(error.error?.message ?? "Unable to sign in.");
          setIsSubmitting(false);
        },
      },
    );
  };

  const isForbidden = searchParams.get("reason") === "forbidden";

  return (
    <Card className="p-2">
      <CardHeader>
        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground shadow-xs">
          <LockIcon className="size-3.5 text-primary" />
          Internal access
        </div>
        <CardTitle className="text-2xl">Quazom Admin</CardTitle>
        <CardDescription>
          Sign in with the same email and password you use on Quazom. Only
          accounts marked <span className="font-mono text-foreground/80">isAdmin</span> can enter.
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : "Sign in"}
            </Button>
          </form>
        </Form>
        {isForbidden ? (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">Account is signed in but not an admin.</p>
            <p className="mt-1 text-destructive/90">
              You can{" "}
              <button
                type="button"
                onClick={handleSignOut}
                className="underline underline-offset-4 hover:opacity-80"
              >
                sign out
              </button>{" "}
              and try a different account.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
