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
import { validateAlphaAccessKey } from "@/lib/alpha-invites";

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter your name."),
    email: z.email("Please enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
    alphaCode: z
      .string()
      .trim()
      .min(1, "Please enter your alpha access key."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pre-fill the alpha code when the user arrives from an invite email
  // (`/register?key=QUAZOM-XXXX-XXXX-XXXX`), so they don't have to copy
  // it themselves.
  const prefilledKey = searchParams.get("key") ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      alphaCode: prefilledKey,
    },
    mode: "onTouched",
  });

  const onSubmit = async (values: RegisterValues) => {
    setIsSubmitting(true);

    // Validate the alpha key against the AlphaInvite table *before* asking
    // Better Auth to create the user. The key is bound to a specific email,
    // so a stray reuse fails here without ever creating a row. After signup,
    // the auth `user.create.after` hook marks the matching invite redeemed.
    const validation = await validateAlphaAccessKey({
      email: values.email,
      accessKey: values.alphaCode,
    });
    if (!validation.ok) {
      form.setError("alphaCode", { message: validation.error });
      setIsSubmitting(false);
      return;
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
            <FormField
              control={form.control}
              name="alphaCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alpha access key</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="off"
                      disabled={isSubmitting}
                      placeholder="QUAZOM-XXXX-XXXX-XXXX"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The unique key from your invite email. Bound to the
                    email address you signed up with.
                  </FormDescription>
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
