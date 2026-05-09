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
      <Kicker>Verify your email</Kicker>
      <H1>
        One last step, <Italic>{firstName}.</Italic>
      </H1>
      <Body>
        Confirm this is your email so we know it&rsquo;s really you. The
        link below is unique to you and signs you straight into Quazom.
      </Body>

      <PrimaryButton href={verifyUrl}>Verify my email</PrimaryButton>

      <Meta>
        If the button doesn&rsquo;t work, paste this link into your
        browser:
      </Meta>
      <MonoBlock>{verifyUrl}</MonoBlock>

      <Meta>
        Didn&rsquo;t sign up for Quazom? You can safely ignore this email
        &mdash; nothing happens until the link is opened.
      </Meta>
    </BrandedLayout>
  );
}

EmailVerification.PreviewProps = {
  firstName: "Ada",
  verifyUrl:
    "http://localhost:3001/api/auth/verify-email?token=preview-token&callbackURL=/",
} satisfies EmailVerificationProps;

export default EmailVerification;
