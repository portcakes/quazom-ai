import * as React from "react";
import { Button, Heading, Section, Text } from "react-email";
import { BrandedLayout } from "../components/branded-layout";

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
      <Heading
        as="h1"
        className="m-0 text-2xl font-bold leading-tight tracking-tight text-[#0a0a0a]"
      >
        Your seat is ready, {firstName}.
      </Heading>
      <Text className="mt-3 text-[15px] leading-relaxed text-[#404040]">
        A spot just opened in the Quazom alpha and we saved it for you.
        Use your personal access key below to create your account &mdash;
        it&rsquo;s tied to this email and works exactly once.
      </Text>

      <Section className="mt-6 rounded-xl border border-[#0a0a0a] bg-[#0a0a0a] p-5 text-center">
        <Text className="m-0 text-[11px] font-medium uppercase tracking-[0.18em] text-[#a8a29e]">
          Your alpha access key
        </Text>
        <Text className="mt-2 mb-0 font-mono text-[18px] font-semibold tracking-[0.08em] text-white">
          {accessKey}
        </Text>
      </Section>

      <Section className="mt-6 text-center">
        <Button
          href={registerUrl}
          className="rounded-lg bg-[#0a0a0a] px-5 py-3 text-sm font-medium text-white"
        >
          Create your account
        </Button>
      </Section>

      <Text className="mt-6 text-[13px] leading-relaxed text-[#525252]">
        This key expires on <strong>{expiresLabel}</strong>. After that
        we&rsquo;ll need to mint you a fresh one &mdash; just reply and
        we&rsquo;ll send another.
      </Text>

      <Text className="mt-3 text-[13px] leading-relaxed text-[#737373]">
        Heads up: the alpha is intentionally rough around the edges. Tell
        us what works and what doesn&rsquo;t &mdash; your feedback shapes
        what ships next.
      </Text>
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
