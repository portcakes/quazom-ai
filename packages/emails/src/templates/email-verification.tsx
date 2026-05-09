import * as React from "react";
import { Button, Heading, Section, Text } from "react-email";
import { BrandedLayout } from "../components/branded-layout";

export type EmailVerificationProps = {
  firstName: string;
  verifyUrl: string;
};

export function EmailVerification({
  firstName,
  verifyUrl,
}: EmailVerificationProps) {
  return (
    <BrandedLayout preview="Verify your Quazom email to finish signing up.">
      <Heading
        as="h1"
        className="m-0 text-2xl font-bold leading-tight tracking-tight text-[#0a0a0a]"
      >
        One last step, {firstName}.
      </Heading>
      <Text className="mt-3 text-[15px] leading-relaxed text-[#404040]">
        Confirm this is your email so we know it&rsquo;s really you. The
        link below is unique to you and signs you straight into Quazom.
      </Text>

      <Section className="mt-6 text-center">
        <Button
          href={verifyUrl}
          className="rounded-lg bg-[#0a0a0a] px-5 py-3 text-sm font-medium text-white"
        >
          Verify my email
        </Button>
      </Section>

      <Text className="mt-6 text-[13px] leading-relaxed text-[#525252]">
        If the button doesn&rsquo;t work, paste this link into your
        browser:
      </Text>
      <Text className="mt-1 break-all text-[12px] leading-relaxed text-[#737373]">
        {verifyUrl}
      </Text>

      <Text className="mt-6 text-[13px] leading-relaxed text-[#737373]">
        Didn&rsquo;t sign up for Quazom? You can ignore this email
        &mdash; nothing will happen until the link is opened.
      </Text>
    </BrandedLayout>
  );
}

EmailVerification.PreviewProps = {
  firstName: "Ada",
  verifyUrl:
    "http://localhost:3001/api/auth/verify-email?token=preview-token&callbackURL=/",
} satisfies EmailVerificationProps;

export default EmailVerification;
