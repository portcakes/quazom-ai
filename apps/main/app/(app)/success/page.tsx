import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { Button } from "@quazom-ai/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quazom-ai/ui/components/ui/card";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";

export const metadata = {
  title: "Welcome to Quazom",
};

/**
 * Polar redirects here after a successful checkout. The actual subscription
 * activation happens server-side (the polar webhook updates the User row),
 * so this page is intentionally tiny — it just thanks the user and points
 * them back to either Settings (to pick their new title) or the app home.
 *
 * `?checkout_id={CHECKOUT_ID}` arrives in the URL but we don't need it to
 * render: the user's session already has the new plan once the webhook
 * lands.
 */
export default async function CheckoutSuccessPage() {
  await requireAuth();
  const user = await getCurrentUser();
  const firstName = user?.firstName ?? "there";

  return (
    <div className="flex min-w-0 flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-12 md:gap-4">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome to the next chapter, {firstName}.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Your subscription is being activated. New limits unlock the
            moment Polar confirms the payment — usually within a few seconds.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-3xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-primary" />
              Founding-tier title
            </CardTitle>
            <CardDescription>
              If you upgraded during the founding window (through July 7,
              2026), the matching title — <strong>Founding Explorer</strong> or
              <strong> Founding Scholar</strong> — has been added to your
              account. Pick which one you want displayed alongside your name
              from the Settings page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="cursor-pointer">
              <Link href="/settings">Open Settings</Link>
            </Button>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
