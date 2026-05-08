"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@quazom-ai/ui/components/ui/button";
import { Input } from "@quazom-ai/ui/components/ui/input";
import { Label } from "@quazom-ai/ui/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@quazom-ai/ui/components/ui/radio-group";
import { Spinner } from "@quazom-ai/ui/components/ui/spinner";
import { useTRPC } from "@/trpc/client";

const REFERRAL_OPTIONS = [
  "Friend or colleague",
  "Search engine",
  "Social media (X, LinkedIn, …)",
  "Reddit or a forum",
  "Blog or article",
  "YouTube",
  "Other",
] as const;

type ReferralOption = (typeof REFERRAL_OPTIONS)[number];

type Props = {
  createdCurriculumId: string | null;
  onComplete: () => void;
};

export function ReferralStep({ createdCurriculumId, onComplete }: Props) {
  const trpc = useTRPC();
  const [choice, setChoice] = useState<ReferralOption | null>(null);
  const [otherDetail, setOtherDetail] = useState("");

  const complete = useMutation(
    trpc.completeOnboarding.mutationOptions({
      onSuccess: () => {
        onComplete();
      },
      onError: (err) => toast.error(err.message ?? "Couldn't finish onboarding"),
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!choice) return;
    // For "Other" we glue any free-text the user typed onto the canonical
    // label so analytics still see "Other" as the bucket but we keep the
    // detail.
    const referralSource =
      choice === "Other" && otherDetail.trim()
        ? `Other: ${otherDetail.trim().slice(0, 100)}`
        : choice;
    complete.mutate({ referralSource });
  };

  const handleSkip = () => {
    complete.mutate({});
  };

  const isPending = complete.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          How did you hear about Quazom?
        </Label>
        <RadioGroup
          value={choice ?? ""}
          onValueChange={(v) => setChoice(v as ReferralOption)}
          className="gap-2"
        >
          {REFERRAL_OPTIONS.map((option) => (
            <div
              key={option}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2 transition-colors has-data-[state=checked]:border-primary"
            >
              <RadioGroupItem value={option} id={`referral-${option}`} />
              <Label
                htmlFor={`referral-${option}`}
                className="flex-1 cursor-pointer text-sm font-normal"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {choice === "Other" ? (
          <Input
            placeholder="Tell us more (optional)"
            value={otherDetail}
            onChange={(e) => setOtherDetail(e.target.value)}
            maxLength={100}
          />
        ) : null}
        <p className="text-xs text-muted-foreground">
          Totally optional — feel free to skip.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="cursor-pointer"
          onClick={handleSkip}
          disabled={isPending}
        >
          Skip and {createdCurriculumId ? "see my curriculum" : "go to home"}
        </Button>
        <Button
          type="submit"
          className="cursor-pointer"
          disabled={!choice || isPending}
        >
          {isPending ? (
            <Spinner />
          ) : (
            <>Submit {createdCurriculumId ? "& see my curriculum" : "& finish"}</>
          )}
        </Button>
      </div>
    </form>
  );
}
