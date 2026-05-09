import * as React from "react";
import { Button, Heading, Section, Text } from "react-email";
import { BrandedLayout } from "../components/branded-layout";

export type PasswordResetProps = {
  firstName: string;
  resetUrl: string;
  // Minutes until the reset token expires. Surfaced verbatim in the body so
  // the recipient knows how long they have.
  expiresInMinutes: number;
};

export function PasswordReset({
  firstName,
  resetUrl,
  expiresInMinutes,
}: PasswordResetProps) {
  return (
    <BrandedLayout preview="Reset your Quazom password.">
      <Heading
        as="h1"
        className="m-0 text-2xl font-bold leading-tight tracking-tight text-[#0a0a0a]"
      >
        Reset your password, {firstName}.
      </Heading>
      <Text className="mt-3 text-[15px] leading-relaxed text-[#404040]">
        Someone (hopefully you) asked to reset your Quazom password. Use
        the button below to choose a new one.
      </Text>

      <Section className="mt-6 text-center">
        <Button
          href={resetUrl}
          className="rounded-lg bg-[#0a0a0a] px-5 py-3 text-sm font-medium text-white"
        >
          Reset my password
        </Button>
      </Section>

      <Text className="mt-6 text-[13px] leading-relaxed text-[#525252]">
        If the button doesn&rsquo;t work, paste this link into your
        browser:
      </Text>
      <Text className="mt-1 break-all text-[12px] leading-relaxed text-[#737373]">
        {resetUrl}
      </Text>

      <Text className="mt-6 text-[13px] leading-relaxed text-[#737373]">
        This link expires in <strong>{expiresInMinutes} minutes</strong>.
        If you didn&rsquo;t request a reset, you can safely ignore this
        email &mdash; your password won&rsquo;t change.
      </Text>
    </BrandedLayout>
  );
}

PasswordReset.PreviewProps = {
  firstName: "Ada",
  resetUrl:
    "http://localhost:3001/reset-password?token=preview-token",
  expiresInMinutes: 60,
} satisfies PasswordResetProps;

export default PasswordReset;
