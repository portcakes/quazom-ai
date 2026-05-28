import { requireOnboardingSession } from "@/lib/auth-utils";
import { OnboardingFlow } from "@/components/features/onboarding/onboarding-flow";

export const metadata = {
  title: "Quazom - Welcome to Quazom!",
  description: "Welcome to Quazom! Let's get you started on your personalized learning journey.",
};

export default async function OnboardingPage() {
  const session = await requireOnboardingSession();
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-muted/40 to-background">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-xl">
          <OnboardingFlow firstName={firstName} />
        </div>
      </main>
    </div>
  );
}
