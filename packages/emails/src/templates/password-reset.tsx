import * as React from "react";
import { BrandedLayout } from "../components/branded-layout";
import {
  Body,
  H1,
  Italic,
  Kicker,
  Meta,
  MonoBlock,
  PrimaryButton,
} from "../components/atoms";
import { palette } from "../components/theme";

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
      <Kicker>Reset your password</Kicker>
      <H1>
        New password, <Italic>{firstName}?</Italic>
      </H1>
      <Body>
        Someone (hopefully you) asked to reset your Quazom password. Use
        the button below to choose a new one.
      </Body>

      <PrimaryButton href={resetUrl}>Reset my password</PrimaryButton>

      <Meta>
        If the button doesn&rsquo;t work, paste this link into your
        browser:
      </Meta>
      <MonoBlock>{resetUrl}</MonoBlock>

      <Meta>
        This link expires in{" "}
        <span style={{ fontWeight: 700, color: palette.foreground }}>
          {expiresInMinutes} minutes
        </span>
        . If you didn&rsquo;t request a reset, you can safely ignore
        this email &mdash; your password won&rsquo;t change.
      </Meta>
    </BrandedLayout>
  );
}

PasswordReset.PreviewProps = {
  firstName: "Ada",
  resetUrl: "http://localhost:3001/reset-password?token=preview-token",
  expiresInMinutes: 60,
} satisfies PasswordResetProps;

export default PasswordReset;
