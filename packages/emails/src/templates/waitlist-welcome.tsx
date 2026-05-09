import * as React from "react";
import { Heading, Section, Text } from "react-email";
import { BrandedLayout } from "../components/branded-layout";

export type WaitlistWelcomeProps = {
  firstName: string;
};

export function WaitlistWelcome({ firstName }: WaitlistWelcomeProps) {
  return (
    <BrandedLayout
      preview={`You're on the Quazom waitlist, ${firstName}.`}
    >
      <Heading
        as="h1"
        className="m-0 text-2xl font-bold leading-tight tracking-tight text-[#0a0a0a]"
      >
        You&rsquo;re on the list, {firstName}.
      </Heading>
      <Text className="mt-3 text-[15px] leading-relaxed text-[#404040]">
        Thanks for signing up for the Quazom alpha. We&rsquo;ve saved your
        spot and we&rsquo;ll email you the moment a seat opens up &mdash;
        usually within the next few weeks.
      </Text>
      <Section className="mt-6 rounded-xl border border-[#e7e5e4] bg-[#fafaf9] p-4">
        <Text className="m-0 text-sm font-semibold text-[#0a0a0a]">
          What happens next
        </Text>
        <Text className="mt-2 text-[13px] leading-relaxed text-[#525252]">
          We open new alpha seats every week. When it&rsquo;s your turn,
          we&rsquo;ll send a personal invite with everything you need to get
          your first curriculum running in minutes.
        </Text>
      </Section>
      <Text className="mt-6 text-[13px] leading-relaxed text-[#737373]">
        Want to skip the line? Reply to this email and tell us what
        you&rsquo;re hoping to learn first &mdash; we move feedback-rich
        signups up the queue.
      </Text>
    </BrandedLayout>
  );
}

WaitlistWelcome.PreviewProps = {
  firstName: "Ada",
} satisfies WaitlistWelcomeProps;

export default WaitlistWelcome;
