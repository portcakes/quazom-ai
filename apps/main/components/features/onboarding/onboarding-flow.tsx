"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@quazom-ai/ui/components/ui/card";
import { CurriculumStep } from "./curriculum-step";
import { ReferralStep } from "./referral-step";

type Step = "curriculum" | "referral";

type Props = {
  firstName: string;
};

/**
 * Two-step first-run flow. Step 1 is the curriculum prompt (create or skip);
 * step 2 is the optional "how did you hear about us?" survey. Either action
 * on step 2 (submit OR skip) calls `completeOnboarding`, which is what
 * actually flips the `isOnboarded` flag.
 *
 * State is local — we don't persist between page loads. If the user navigates
 * away mid-flow, the auth guard will land them right back here on next visit
 * and they start over.
 */
export function OnboardingFlow({ firstName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("curriculum");
  const [createdCurriculumId, setCreatedCurriculumId] = useState<string | null>(
    null,
  );

  const goToReferral = (curriculumId: string | null) => {
    setCreatedCurriculumId(curriculumId);
    setStep("referral");
  };

  const finishOnboarding = () => {
    if (createdCurriculumId) {
      router.push(`/curricula/${createdCurriculumId}`);
    } else {
      router.push("/");
    }
    router.refresh();
  };

  return (
    <Card className="p-2 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="font-heading text-2xl">
              {step === "curriculum"
                ? `Welcome, ${firstName}!`
                : "One last thing"}
            </CardTitle>
            <CardDescription>
              {step === "curriculum"
                ? "Let's spin up your first AI-generated curriculum. You can always do this later."
                : "Mind sharing how you found us? It really helps."}
            </CardDescription>
          </div>
          <StepBadge step={step} />
        </div>
      </CardHeader>
      <CardContent>
        {step === "curriculum" ? (
          <CurriculumStep onAdvance={goToReferral} />
        ) : (
          <ReferralStep
            createdCurriculumId={createdCurriculumId}
            onComplete={finishOnboarding}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StepBadge({ step }: { step: Step }) {
  const current = step === "curriculum" ? 1 : 2;
  return (
    <span className="shrink-0 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Step {current} of 2
    </span>
  );
}
