import * as React from "react";
import { BrandedLayout } from "../components/branded-layout";
import {
  Body,
  Callout,
  H1,
  Italic,
  Kicker,
  Meta,
} from "../components/atoms";
import { fontStacks, palette } from "../components/theme";
import { Text } from "react-email";

export type WaitlistWelcomeProps = {
  firstName: string;
};

export function WaitlistWelcome({ firstName }: WaitlistWelcomeProps) {
  return (
    <BrandedLayout
      preview={`You're on the Quazom waitlist, ${firstName}.`}
    >
      <Kicker>You&rsquo;re on the list</Kicker>
      <H1>
        Welcome aboard, <Italic>{firstName}.</Italic>
      </H1>
      <Body>
        Thanks for signing up for the Quazom alpha. We&rsquo;ve saved your
        spot and we&rsquo;ll email you the moment a seat opens up &mdash;
        usually within the next few weeks.
      </Body>

      <Callout>
        <Text
          style={{
            margin: 0,
            fontFamily: fontStacks.serif,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: palette.primary,
          }}
        >
          What happens next
        </Text>
        <Text
          style={{
            margin: "8px 0 0",
            fontFamily: fontStacks.serif,
            fontSize: 14,
            lineHeight: 1.65,
            color: palette.foreground,
          }}
        >
          We open new alpha seats every week. When it&rsquo;s your turn,
          we&rsquo;ll send a personal invite with a unique access key so
          you can spin up your first curriculum in minutes.
        </Text>
      </Callout>

      <Meta>
        Want to skip the line? Reply to this email and tell us what
        you&rsquo;re hoping to learn first &mdash; we move feedback-rich
        signups up the queue.
      </Meta>
    </BrandedLayout>
  );
}

WaitlistWelcome.PreviewProps = {
  firstName: "Ada",
} satisfies WaitlistWelcomeProps;

export default WaitlistWelcome;
