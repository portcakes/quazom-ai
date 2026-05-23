"use client";

import { useState } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@quazom-ai/ui/components/ui/form";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter your name."),
    email: z.email("Please enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

// Mirror the keys accepted by `apps/main/app/api/checkout-intent/route.ts`.
// Any other value coming in from the marketing site CTAs is treated as
// "no intent" so a tampered URL can't push a user into a wrong checkout.
const ALLOWED_PLANS = new Set(["explorer", "scholar"]);
const ALLOWED_INTERVALS = new Set(["month", "year"]);

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onTouched",
  });

  const onSubmit = async (values: RegisterValues) => {
    setIsSubmitting(true);

    // If the user arrived from a Founding-tier CTA (e.g.
    // `/register?plan=explorer&checkout=1`), capture that intent in a
    // short-lived httpOnly cookie. The cookie survives the email-verification
    // round trip so the in-app CheckoutIntentLauncher can fire the Polar
    // checkout once they finish onboarding.
    const planParam = searchParams.get("plan")?.toLowerCase() ?? null;
    const intervalParam =
      searchParams.get("interval")?.toLowerCase() ?? "month";
    const checkoutFlag = searchParams.get("checkout");
    if (
      checkoutFlag === "1" &&
      planParam &&
      ALLOWED_PLANS.has(planParam) &&
      ALLOWED_INTERVALS.has(intervalParam)
    ) {
      try {
        await fetch("/api/checkout-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planParam, interval: intervalParam }),
        });
      } catch (err) {
        // Best-effort — if the cookie write fails the user can still upgrade
        // from the in-app Settings page, so we don't block signup on it.
        console.warn("[register] failed to persist checkout intent", err);
      }
    }

    // The callbackURL is what Better Auth appends to the verification email
    // link, so the user lands on /login with a "verified, please sign in"
    // toast after they click it.
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";

    await authClient.signUp.email(
      {
        name: values.name,
        email: values.email,
        password: values.password,
        callbackURL: `${origin}/login?verified=true`,
      },
      {
        onSuccess: () => {
          toast.success(
            "Welcome to Quazom! Check your email to verify your address.",
          );
          // requireEmailVerification is on, so even if Better Auth created
          // a session the next protected route bounces them to /login. Send
          // them straight there.
          router.push("/login?verify=pending");
          router.refresh();
        },
        onError: (error) => {
          toast.error(error.error?.message ?? "Unable to create your account.");
          setIsSubmitting(false);
        },
      },
    );
  };

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          Start generating personalized curricula in minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleAuthButton
          mode="signIn"
          label="Sign up with Google"
          callbackURL="/"
        />
        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span>or</span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="name"
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
                  <FormLabel>Confirm password</FormLabel>
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
              {isSubmitting ? <Spinner /> : "Create account"}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Login here!
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
