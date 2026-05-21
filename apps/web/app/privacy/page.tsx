import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import {
  LegalBody,
  LegalEmail,
  LegalHero,
  LegalLi,
  LegalList,
  LegalSection,
  LegalSiteHeader,
  LegalSubsection,
} from "@/components/layout/legal-prose";

export const metadata: Metadata = {
  title: "Privacy Policy · Quazom",
  description:
    "How Quazom collects, uses, stores, and protects information when you use the platform.",
};

const EFFECTIVE_DATE = "May 21, 2026";
const LAST_UPDATED = "May 21, 2026";

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
    >
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LegalSiteHeader />
      <main className="flex flex-1 flex-col">
        <LegalHero
          title="Privacy Policy"
          effectiveDate={EFFECTIVE_DATE}
          lastUpdated={LAST_UPDATED}
          intro={
            <>
              <p>
                Quazom (&ldquo;Quazom,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo;
                or &ldquo;us&rdquo;) respects your privacy and believes your
                learning, research, notes, and intellectual work should remain
                under your control.
              </p>
              <p>
                This Privacy Policy explains how we collect, use, store, and
                protect information when you use the Quazom platform, websites,
                applications, and related services (collectively, the
                &ldquo;Service&rdquo;).
              </p>
              <p>
                By using Quazom, you agree to the practices described in this
                Privacy Policy.
              </p>
            </>
          }
        />
        <LegalBody>
          <LegalSection id="information-we-collect" title="1. Information We Collect">
            <p>
              We collect information you provide directly, information generated
              through your use of the Service, and certain technical information
              necessary to operate the platform.
            </p>
            <LegalSubsection title="A. Account Information">
              <p>When you create an account, we may collect:</p>
              <LegalList>
                <LegalLi>your name or username,</LegalLi>
                <LegalLi>email address,</LegalLi>
                <LegalLi>authentication provider information,</LegalLi>
                <LegalLi>profile image,</LegalLi>
                <LegalLi>billing information,</LegalLi>
                <LegalLi>subscription status,</LegalLi>
                <LegalLi>and account preferences.</LegalLi>
              </LegalList>
              <p>
                Payment information is typically processed through third-party
                payment processors and is not stored directly by Quazom.
              </p>
            </LegalSubsection>
          </LegalSection>

          <LegalSection id="user-generated-content" title="2. User-Generated Content">
            <p>
              We collect and store content you create, upload, or submit through
              Quazom, including:
            </p>
            <LegalList>
              <LegalLi>notes,</LegalLi>
              <LegalLi>annotations,</LegalLi>
              <LegalLi>curricula,</LegalLi>
              <LegalLi>continuity notes,</LegalLi>
              <LegalLi>uploaded files,</LegalLi>
              <LegalLi>PDFs,</LegalLi>
              <LegalLi>audio files,</LegalLi>
              <LegalLi>transcripts,</LegalLi>
              <LegalLi>schedules,</LegalLi>
              <LegalLi>generated lessons,</LegalLi>
              <LegalLi>prompts,</LegalLi>
              <LegalLi>quizzes,</LegalLi>
              <LegalLi>assignments,</LegalLi>
              <LegalLi>research materials,</LegalLi>
              <LegalLi>
                and other educational or organizational content.
              </LegalLi>
            </LegalList>
            <p>
              This content is processed to provide the functionality of the
              Service.
            </p>
          </LegalSection>

          <LegalSection id="ai-interaction-data" title="3. AI Interaction Data">
            <p>To provide AI-assisted features, we may process:</p>
            <LegalList>
              <LegalLi>prompts,</LegalLi>
              <LegalLi>uploaded content,</LegalLi>
              <LegalLi>generated outputs,</LegalLi>
              <LegalLi>lesson requests,</LegalLi>
              <LegalLi>continuity data,</LegalLi>
              <LegalLi>and interactions with AI tools.</LegalLi>
            </LegalList>
            <p>This processing may involve third-party AI providers.</p>
            <p>
              AI-generated outputs are probabilistic and may not always be
              accurate.
            </p>
          </LegalSection>

          <LegalSection
            id="usage-technical"
            title="4. Usage & Technical Information"
          >
            <p>We may automatically collect:</p>
            <LegalList>
              <LegalLi>browser type,</LegalLi>
              <LegalLi>device information,</LegalLi>
              <LegalLi>operating system,</LegalLi>
              <LegalLi>IP address,</LegalLi>
              <LegalLi>session data,</LegalLi>
              <LegalLi>feature usage metrics,</LegalLi>
              <LegalLi>crash reports,</LegalLi>
              <LegalLi>referral URLs,</LegalLi>
              <LegalLi>interaction events,</LegalLi>
              <LegalLi>and general analytics data.</LegalLi>
            </LegalList>
            <p>This information helps us:</p>
            <LegalList>
              <LegalLi>maintain platform stability,</LegalLi>
              <LegalLi>understand feature usage,</LegalLi>
              <LegalLi>improve performance,</LegalLi>
              <LegalLi>detect abuse,</LegalLi>
              <LegalLi>and improve user experience.</LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection id="how-we-use" title="5. How We Use Information">
            <p>We use collected information to:</p>
            <LegalList>
              <LegalLi>provide and maintain the Service,</LegalLi>
              <LegalLi>generate requested educational content,</LegalLi>
              <LegalLi>sync and store user work,</LegalLi>
              <LegalLi>authenticate users,</LegalLi>
              <LegalLi>process payments,</LegalLi>
              <LegalLi>personalize learning experiences,</LegalLi>
              <LegalLi>improve platform functionality,</LegalLi>
              <LegalLi>monitor platform performance,</LegalLi>
              <LegalLi>detect fraud or abuse,</LegalLi>
              <LegalLi>comply with legal obligations,</LegalLi>
              <LegalLi>and communicate with users.</LegalLi>
            </LegalList>
            <p>We may also use aggregated and anonymized data for:</p>
            <LegalList>
              <LegalLi>analytics,</LegalLi>
              <LegalLi>product development,</LegalLi>
              <LegalLi>platform optimization,</LegalLi>
              <LegalLi>
                and research into educational tooling and learning systems.
              </LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection
            id="ai-providers"
            title="6. AI Processing & Third-Party AI Providers"
          >
            <p>
              Some Quazom features rely on third-party AI providers to generate
              educational content, summaries, transcripts, audio, and other
              outputs.
            </p>
            <p>These providers may process:</p>
            <LegalList>
              <LegalLi>prompts,</LegalLi>
              <LegalLi>uploaded content,</LegalLi>
              <LegalLi>notes,</LegalLi>
              <LegalLi>transcripts,</LegalLi>
              <LegalLi>and generated requests.</LegalLi>
            </LegalList>
            <p>Third-party providers may include:</p>
            <LegalList>
              <LegalLi>
                <ExternalLink href="https://ai.google.dev?utm_source=quazom.ai">
                  Google
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>
                <ExternalLink href="https://openai.com?utm_source=quazom.ai">
                  OpenAI
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>or other AI infrastructure providers.</LegalLi>
            </LegalList>
            <p>
              Quazom attempts to use AI services and API configurations that
              prioritize user privacy and reduce or eliminate model training on
              submitted API data where possible.
            </p>
            <p>
              However, third-party provider practices may change over time, and
              your use of Quazom acknowledges that certain data processing is
              necessary to provide AI-powered features.
            </p>
          </LegalSection>

          <LegalSection
            id="ownership"
            title="7. Ownership & Intellectual Privacy"
          >
            <p>
              We believe your learning materials, notes, and intellectual work
              belong to you.
            </p>
            <p>
              Quazom does not sell your notes, uploaded documents, curricula, or
              research content to advertisers or data brokers.
            </p>
            <p>We do not use private user content for targeted advertising.</p>
            <p>We do not claim ownership over your intellectual work.</p>
            <p>Your content is processed solely to:</p>
            <LegalList>
              <LegalLi>operate the platform,</LegalLi>
              <LegalLi>provide requested features,</LegalLi>
              <LegalLi>improve platform reliability,</LegalLi>
              <LegalLi>and maintain system functionality.</LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection id="sharing" title="8. Sharing of Information">
            <p>We do not sell personal information.</p>
            <p>We may share information:</p>
            <LegalList>
              <LegalLi>with service providers necessary to operate Quazom,</LegalLi>
              <LegalLi>with payment processors,</LegalLi>
              <LegalLi>with authentication providers,</LegalLi>
              <LegalLi>with cloud hosting and infrastructure providers,</LegalLi>
              <LegalLi>with analytics providers,</LegalLi>
              <LegalLi>or when required by law.</LegalLi>
            </LegalList>
            <p>We may also disclose information:</p>
            <LegalList>
              <LegalLi>to protect user safety,</LegalLi>
              <LegalLi>
                enforce our{" "}
                <Link
                  href="/terms"
                  className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  Terms
                </Link>
                ,
              </LegalLi>
              <LegalLi>investigate fraud or abuse,</LegalLi>
              <LegalLi>or comply with legal obligations.</LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection id="third-party-services" title="9. Third-Party Services">
            <p>
              Quazom may integrate with or rely upon third-party providers and
              infrastructure services, including:
            </p>
            <LegalList>
              <LegalLi>
                <ExternalLink href="https://better-auth.com?utm_source=quazom.ai">
                  better-auth.com
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>
                <ExternalLink href="https://polar.sh?utm_source=quazom.ai">
                  polar.sh
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>
                <ExternalLink href="https://neon.com?utm_source=quazom.ai">
                  neon.com
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>
                <ExternalLink href="https://vercel.com?utm_source=quazom.ai">
                  vercel.com
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>
                <ExternalLink href="https://ai.google.dev?utm_source=quazom.ai">
                  ai.google.dev
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>
                <ExternalLink href="https://openai.com?utm_source=quazom.ai">
                  openai.com
                </ExternalLink>
                ,
              </LegalLi>
              <LegalLi>analytics providers,</LegalLi>
              <LegalLi>and other operational vendors.</LegalLi>
            </LegalList>
            <p>
              Your use of Quazom may also be subject to the privacy policies of
              those providers.
            </p>
          </LegalSection>

          <LegalSection id="cookies" title="10. Cookies & Analytics">
            <p>Quazom may use:</p>
            <LegalList>
              <LegalLi>cookies,</LegalLi>
              <LegalLi>local storage,</LegalLi>
              <LegalLi>session tokens,</LegalLi>
              <LegalLi>and analytics technologies</LegalLi>
            </LegalList>
            <p>to:</p>
            <LegalList>
              <LegalLi>keep users signed in,</LegalLi>
              <LegalLi>remember preferences,</LegalLi>
              <LegalLi>monitor platform performance,</LegalLi>
              <LegalLi>and improve usability.</LegalLi>
            </LegalList>
            <p>
              You may be able to disable certain browser tracking technologies
              through your browser settings, though some features may not
              function properly.
            </p>
          </LegalSection>

          <LegalSection id="retention" title="11. Data Retention">
            <p>We retain information for as long as necessary to:</p>
            <LegalList>
              <LegalLi>provide the Service,</LegalLi>
              <LegalLi>comply with legal obligations,</LegalLi>
              <LegalLi>resolve disputes,</LegalLi>
              <LegalLi>enforce agreements,</LegalLi>
              <LegalLi>and maintain backups and security systems.</LegalLi>
            </LegalList>
            <p>Deleted content may persist temporarily in:</p>
            <LegalList>
              <LegalLi>backups,</LegalLi>
              <LegalLi>logs,</LegalLi>
              <LegalLi>or disaster recovery systems</LegalLi>
            </LegalList>
            <p>before being permanently removed.</p>
          </LegalSection>

          <LegalSection id="account-deletion" title="12. Account Deletion">
            <p>
              You may request deletion of your account and associated personal
              information.
            </p>
            <p>Upon deletion request:</p>
            <LegalList>
              <LegalLi>active account access will be removed,</LegalLi>
              <LegalLi>user content will be scheduled for deletion,</LegalLi>
              <LegalLi>
                and certain information may remain temporarily in backups or
                where legally required.
              </LegalLi>
            </LegalList>
            <p>
              Some anonymized or aggregated analytics data may persist after
              deletion.
            </p>
          </LegalSection>

          <LegalSection id="security" title="13. Security">
            <p>
              We implement reasonable administrative, technical, and
              organizational safeguards intended to protect user information.
            </p>
            <p>These measures may include:</p>
            <LegalList>
              <LegalLi>encrypted connections,</LegalLi>
              <LegalLi>secure authentication systems,</LegalLi>
              <LegalLi>access controls,</LegalLi>
              <LegalLi>infrastructure monitoring,</LegalLi>
              <LegalLi>and secure cloud hosting practices.</LegalLi>
            </LegalList>
            <p>
              However, no method of storage or transmission is completely
              secure, and we cannot guarantee absolute security.
            </p>
          </LegalSection>

          <LegalSection id="children" title="14. Children's Privacy">
            <p>
              Quazom is not intended for children under 13 without parental or
              guardian involvement.
            </p>
            <p>
              If we learn that personal information has been collected from a
              child in violation of applicable law, we will take reasonable
              steps to remove the information.
            </p>
            <p>
              Future educational or homeschool-oriented versions of Quazom may
              include additional protections or parental controls where
              required.
            </p>
          </LegalSection>

          <LegalSection id="international" title="15. International Users">
            <p>
              If you access Quazom outside the United States, you understand
              that your information may be transferred to and processed in
              jurisdictions where privacy laws may differ from those in your
              location.
            </p>
          </LegalSection>

          <LegalSection id="rights" title="16. Your Rights">
            <p>
              Depending on your jurisdiction, you may have rights to:
            </p>
            <LegalList>
              <LegalLi>access your information,</LegalLi>
              <LegalLi>correct inaccurate information,</LegalLi>
              <LegalLi>request deletion,</LegalLi>
              <LegalLi>export your data,</LegalLi>
              <LegalLi>or object to certain processing activities.</LegalLi>
            </LegalList>
            <p>
              Requests may be submitted to{" "}
              <LegalEmail address="privacy@quazom.ai" />.
            </p>
          </LegalSection>

          <LegalSection id="changes" title="17. Changes to This Privacy Policy">
            <p>We may update this Privacy Policy from time to time.</p>
            <p>
              If material changes are made, we will provide reasonable notice
              through the Service or other appropriate methods.
            </p>
            <p>
              Your continued use of Quazom after updates become effective
              constitutes acceptance of the revised policy.
            </p>
          </LegalSection>

          <LegalSection id="contact" title="18. Contact">
            <p>
              If you have questions about this Privacy Policy or your data, you
              may contact us at <LegalEmail address="privacy@quazom.ai" />.
            </p>
          </LegalSection>

          <LegalSection id="philosophy" title="19. Our Philosophy">
            <p>
              Quazom is built around the belief that learning should be
              exploratory, interdisciplinary, self-directed, and human-centered.
            </p>
            <p>We believe:</p>
            <LegalList>
              <LegalLi>your notes belong to you,</LegalLi>
              <LegalLi>your intellectual journey deserves privacy,</LegalLi>
              <LegalLi>
                and educational technology should empower curiosity rather than
                exploit attention.
              </LegalLi>
            </LegalList>
            <p>
              Our goal is to build tools that augment human learning and
              continuity of thought while respecting user autonomy, ownership,
              and trust.
            </p>
          </LegalSection>
        </LegalBody>
      </main>
      <SiteFooter />
    </div>
  );
}
