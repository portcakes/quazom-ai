"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { linkGoogleAccount, signInWithGoogle } from "@/lib/auth-client";

type Props = {
  // "signIn" hits authClient.signIn.social — used by /login and /register for
  // both first-time Google signup and returning Google sign-in. Better Auth
  // resolves whether to create or link based on the email match.
  // "link" hits authClient.linkSocial — used from /settings to attach Google
  // to the currently signed-in user (must already have a session).
  mode: "signIn" | "link";
  label: string;
  // Where Better Auth should drop the user after the round-trip through
  // Google. For sign-in modes this is the post-login destination; for link
  // mode it's where the settings page wants to resume.
  callbackURL: string;
  className?: string;
};

export function GoogleAuthButton({ mode, label, callbackURL, className }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    setIsSubmitting(true);
    try {
      const action = mode === "signIn" ? signInWithGoogle : linkGoogleAccount;
      const result = await action(callbackURL);
      // The Better Auth client redirects the browser to Google on success, so
      // we usually never reach the lines below — but if the SDK returns an
      // error object instead of throwing, surface it.
      const error = (result as { error?: { message?: string } } | undefined)?.error;
      if (error) {
        toast.error(error.message ?? "Unable to continue with Google.");
        setIsSubmitting(false);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to continue with Google.";
      toast.error(message);
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "w-full"}
      onClick={handleClick}
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <Spinner />
      ) : (
        <>
          <GoogleIcon />
          {label}
        </>
      )}
    </Button>
  );
}

// Official Google "G" mark. Inlined as an SVG so it stays crisp at any size
// and respects the surrounding flex/gap rules in the Button component.
function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
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
