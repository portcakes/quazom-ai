"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

type Props = {
  className?: string;
};

export function SignOutButton({ className }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handle = async () => {
    setPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
        onError: (error) => {
          toast.error(error.error?.message ?? "Couldn't sign out.");
          setPending(false);
        },
      },
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handle}
      disabled={pending}
      className={className}
    >
      {pending ? <Spinner /> : <LogOutIcon className="size-3.5" />}
      Sign out
    </Button>
  );
}
