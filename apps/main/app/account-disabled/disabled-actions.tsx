"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { useTRPC } from "@/trpc/client";
import { authClient } from "@/lib/auth-client";

export function DisabledActions() {
  const router = useRouter();
  const trpc = useTRPC();

  const enable = useMutation(
    trpc.enableAccount.mutationOptions({
      onSuccess: () => {
        toast.success("Welcome back! Your account is active again.");
        router.push("/");
        router.refresh();
      },
      onError: (err) => toast.error(err.message ?? "Failed to re-enable account"),
    }),
  );

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
        onError: (error) => {
          toast.error(error.error?.message ?? "Unable to sign out.");
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        className="cursor-pointer sm:flex-1"
        onClick={() => enable.mutate()}
        disabled={enable.isPending}
      >
        {enable.isPending ? <Spinner /> : "Re-enable my account"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer sm:flex-1"
        onClick={handleSignOut}
        disabled={enable.isPending}
      >
        Sign out
      </Button>
    </div>
  );
}
