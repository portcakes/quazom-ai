import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import { Card, CardContent } from "@quazom-ai/ui/components/ui/card";
import { DisabledActions } from "./disabled-actions";

export const metadata = {
  title: "Account disabled",
};

export default async function AccountDisabledPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    // Disabled status is per-user. With no session, send them to log in
    // (the login flow will land them back here if their account is still
    // disabled).
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, isDisabled: true, disabledAt: true },
  });
  if (!user?.isDisabled) {
    redirect("/");
  }

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-md p-2">
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Your account is currently disabled. Re-enable it to pick up where
              you left off, or sign out if you&apos;d rather come back later.
            </p>
          </div>
          <DisabledActions />
          <p className="text-xs text-muted-foreground">
            Need to permanently delete your account? Re-enable first, then
            visit{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
