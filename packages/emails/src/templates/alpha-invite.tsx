import * as React from "react";
import { Text } from "react-email";
import { BrandedLayout } from "../components/branded-layout";
import {
  Body,
  Callout,
  H1,
  Italic,
  Kicker,
  Meta,
  MonoBlock,
  PrimaryButton,
} from "../components/atoms";
import { fontStacks, palette } from "../components/theme";

export type AlphaInviteProps = {
  firstName: string;
  accessKey: string;
  registerUrl: string;
  expiresAt: Date;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function AlphaInvite({
  firstName,
  accessKey,
  registerUrl,
  expiresAt,
}: AlphaInviteProps) {
  const expiresLabel = dateFormatter.format(expiresAt);

  return (
    <BrandedLayout
      preview={`Your Quazom alpha invite is ready, ${firstName}.`}
    >
      <Kicker>Your seat is ready</Kicker>
      <H1>
        It&rsquo;s your turn, <Italic>{firstName}.</Italic>
      </H1>
      <Body>
        A spot just opened in the Quazom alpha and we saved it for you.
        Use your personal access key below to create your account &mdash;
        it&rsquo;s tied to this email and works exactly once.
      </Body>

      <Callout align="center">
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
          Your alpha access key
        </Text>
        <MonoBlock emphasis>{accessKey}</MonoBlock>
      </Callout>

      <PrimaryButton href={registerUrl}>Create your account</PrimaryButton>

      <Meta>
        This key expires on{" "}
        <span style={{ fontWeight: 700, color: palette.foreground }}>
          {expiresLabel}
        </span>
        . After that we&rsquo;ll need to mint you a fresh one &mdash;
        just reply and we&rsquo;ll send another.
      </Meta>

      <Meta>
        Heads up: the alpha is intentionally rough around the edges.
        Tell us what works and what doesn&rsquo;t &mdash; your feedback
        shapes what ships next.
      </Meta>
    </BrandedLayout>
  );
}

AlphaInvite.PreviewProps = {
  firstName: "Ada",
  accessKey: "QUAZOM-AB12-CD34-EF56",
  registerUrl: "http://localhost:3001/register?key=QUAZOM-AB12-CD34-EF56",
  expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
} satisfies AlphaInviteProps;

export default AlphaInvite;
