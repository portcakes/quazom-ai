"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

const loginSchema = z.object({
  email: z.email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

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

  // Surface state we got bounced here with so the user knows what happened:
  //   ?verify=pending  → just signed up, check inbox
  //   ?verified=true   → just clicked the verify link, ready to sign in
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified! Sign in to get started.");
    } else if (searchParams.get("verify") === "pending") {
      toast.info(
        "Almost there — check your email to verify your address before signing in.",
      );
    }
    // We only want this to fire on initial mount per query change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          toast.success("Welcome back!");
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

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to continue with your curricula.
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                      Forgot password?
                    </Link>
                  </div>
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
              {isSubmitting ? <Spinner /> : "Login"}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Quazom?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Register here!
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
