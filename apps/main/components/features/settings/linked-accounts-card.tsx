"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quazom-ai/ui/components/ui/card";
import { Skeleton } from "@quazom-ai/ui/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

// Loads the user's linked OAuth accounts from Better Auth and renders a small
// status row for Google. We only surface a "Connect" action — unlinking is
// intentionally out of scope for now (a user who connected Google would lose
// their only sign-in method if they unlinked without first setting a password).
export function LinkedAccountsCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["auth", "list-accounts"],
    queryFn: async () => {
      const result = await authClient.listAccounts();
      if (result.error) {
        throw new Error(
          result.error.message ?? "Failed to load linked accounts.",
        );
      }
      return result.data ?? [];
    },
    staleTime: 30_000,
  });

  const hasGoogle = (data ?? []).some(
    (account) => account.providerId === "google",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked accounts</CardTitle>
        <CardDescription>
          Connect a Google account to sign in faster next time. Your existing
          email and password will keep working too.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            We couldn&apos;t load your linked accounts. Refresh the page to
            try again.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <GoogleIcon />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Google</span>
                <span className="text-xs text-muted-foreground">
                  {hasGoogle
                    ? "Use Sign in with Google on future visits."
                    : "Not connected yet."}
                </span>
              </div>
            </div>
            {hasGoogle ? (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Connected
              </span>
            ) : (
              <GoogleAuthButton
                mode="link"
                label="Connect"
                callbackURL="/settings"
                className=""
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
