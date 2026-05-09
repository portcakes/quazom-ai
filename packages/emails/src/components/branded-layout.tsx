import * as React from "react";
import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { fontStacks, palette } from "./theme";

type Props = {
  preview: string;
  children: React.ReactNode;
};

// Single-source brand chrome (header, footer, type, color tokens) so every
// template stays visually consistent with the rest of the Quazom product:
//   - warm cream/sand surface, warm camel primary, warm brown text
//   - Libre Baskerville serif body / Lora fallback / system Georgia
//   - Italic primary-tinted accent in the wordmark (matches the marketing
//     site's "italic text-primary" heading treatment)
//   - Subtle warm shadow on the card so the email floats on the cream bg
//
// Templates only own the body content between the wordmark and the footer.
export function BrandedLayout({ preview, children }: Props) {
  return (
    <Html lang="en">
      <Head>
        {/* Loaded by Apple Mail / iOS Mail / Outlook Mac / most webmail.
            Outlook Windows ignores @font-face and will fall back to the
            stacks defined in theme.ts (Georgia, etc.), which is fine. */}
        <Font
          fontFamily="Libre Baskerville"
          fallbackFontFamily="Georgia"
          webFont={{
            url: "https://fonts.gstatic.com/s/librebaskerville/v14/kmKnZrc3Hgbbcjq75U4uslyuy4kn0pNeYRI4CN2V.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Libre Baskerville"
          fallbackFontFamily="Georgia"
          webFont={{
            url: "https://fonts.gstatic.com/s/librebaskerville/v14/kmKiZrc3Hgbbcjq75U4uslyuy4kn0qviTjY3MeRDXx_LWg.woff2",
            format: "woff2",
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Libre Baskerville"
          fallbackFontFamily="Georgia"
          webFont={{
            url: "https://fonts.gstatic.com/s/librebaskerville/v14/kmKhZrc3Hgbbcjq75U4uslyuy4kn0qNcaxYaDc2T1lM.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="italic"
        />
        <Font
          fontFamily="IBM Plex Mono"
          fallbackFontFamily="monospace"
          webFont={{
            url: "https://fonts.gstatic.com/s/ibmplexmono/v19/-F6qfjptAgt5VM-kVkqdyU8n5igg1l9kn-s.woff2",
            format: "woff2",
          }}
          fontWeight={500}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body
          style={{
            fontFamily: fontStacks.serif,
            backgroundColor: palette.background,
            color: palette.foreground,
            margin: 0,
            padding: 0,
          }}
        >
          <Container
            style={{
              maxWidth: 560,
              margin: "40px auto",
              backgroundColor: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 18,
              padding: "36px 36px 32px",
              // Warm low-opacity shadow that mirrors the app's --shadow token
              // (offset 2 3, hsl(28 13% 20% / 0.12)).
              boxShadow:
                "2px 3px 5px 0 rgba(74, 56, 35, 0.10), 2px 1px 2px -1px rgba(74, 56, 35, 0.10)",
            }}
          >
            <Section style={{ paddingBottom: 8 }}>
              <Text
                style={{
                  margin: 0,
                  fontFamily: fontStacks.serif,
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: palette.foreground,
                }}
              >
                Quazom
              </Text>
            </Section>
            <Hr
              style={{
                borderColor: palette.border,
                borderTopWidth: 1,
                margin: "16px 0 20px",
              }}
            />
            {children}
            <Hr
              style={{
                borderColor: palette.border,
                borderTopWidth: 1,
                margin: "28px 0 16px",
              }}
            />
            <Section>
              <Text
                style={{
                  margin: 0,
                  fontFamily: fontStacks.serif,
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: palette.mutedFg,
                }}
              >
                You&rsquo;re getting this email because you signed up for
                Quazom. Questions? Just reply &mdash; a real human will get
                back to you. Or email{" "}
                <Link
                  href="mailto:hello@quazom.ai"
                  style={{
                    color: palette.primary,
                    textDecoration: "underline",
                  }}
                >
                  hello@quazom.ai
                </Link>
                .
              </Text>
              <Text
                style={{
                  margin: "8px 0 0",
                  fontFamily: fontStacks.serif,
                  fontSize: 11,
                  letterSpacing: "0.02em",
                  color: palette.mutedFg,
                  opacity: 0.75,
                }}
              >
                © {new Date().getFullYear()} Quazom &middot; Personal
                curricula, generated by AI.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
