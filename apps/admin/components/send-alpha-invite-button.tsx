"use client";

import { useTransition } from "react";
import { MailCheckIcon, MailIcon, SendIcon, UserCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { cn } from "@quazom-ai/ui/lib/utils";
import { sendAlphaInviteToWaitlistEntry } from "@/lib/actions/alpha-invites";

type Variant =
  /** No invite has ever been sent. CTA: "Send invite". */
  | "send"
  /** An invite exists but key expired or never delivered. CTA: "Resend". */
  | "resend"
  /** A live invite is currently in their inbox awaiting click. CTA: "Resend". */
  | "pending"
  /** Member already created an account — button is disabled. */
  | "has-account"
  /** Latest invite has been redeemed — button is disabled. */
  | "redeemed";

type Props = {
  waitlistEntryId: string;
  /** Used in success/error toasts. */
  email: string;
  variant: Variant;
};

export function SendAlphaInviteButton({
  waitlistEntryId,
  email,
  variant,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const disabled =
    variant === "has-account" || variant === "redeemed" || isPending;

  function handleClick() {
    if (disabled) return;
    startTransition(async () => {
      const result = await sendAlphaInviteToWaitlistEntry({ waitlistEntryId });
      if (result.ok) {
        toast.success(`Alpha invite sent to ${email}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const { label, Icon, intent } = labelFor(variant, isPending);

  return (
    <Button
      type="button"
      size="sm"
      variant={intent === "primary" ? "default" : "outline"}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "h-8 gap-1.5 px-2.5 text-xs font-medium",
        intent === "muted" && "text-muted-foreground",
      )}
      aria-label={`${label} for ${email}`}
    >
      {isPending ? <Spinner /> : <Icon className="size-3.5" />}
      <span>{label}</span>
    </Button>
  );
}

function labelFor(
  variant: Variant,
  isPending: boolean,
): {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  intent: "primary" | "muted";
} {
  if (isPending) {
    return { label: "Sending…", Icon: MailIcon, intent: "primary" };
  }
  switch (variant) {
    case "send":
      return { label: "Send invite", Icon: SendIcon, intent: "primary" };
    case "resend":
      return { label: "Resend invite", Icon: MailIcon, intent: "primary" };
    case "pending":
      return { label: "Resend invite", Icon: MailIcon, intent: "primary" };
    case "redeemed":
      return { label: "Redeemed", Icon: MailCheckIcon, intent: "muted" };
    case "has-account":
      return { label: "Has account", Icon: UserCheckIcon, intent: "muted" };
  }
}
