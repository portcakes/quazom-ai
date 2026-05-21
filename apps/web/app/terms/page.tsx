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
  title: "Terms of Service · Quazom",
  description:
    "The terms that govern your access to and use of the Quazom platform, applications, and services.",
};

const EFFECTIVE_DATE = "May 21, 2026";
const LAST_UPDATED = "May 21, 2026";

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LegalSiteHeader />
      <main className="flex flex-1 flex-col">
        <LegalHero
          title="Terms of Service"
          effectiveDate={EFFECTIVE_DATE}
          lastUpdated={LAST_UPDATED}
          intro={
            <>
              <p>
                Welcome to Quazom. These Terms of Service (&ldquo;Terms&rdquo;)
                govern your access to and use of the Quazom platform, websites,
                applications, and services (collectively, the &ldquo;Service&rdquo;)
                operated by Quazom (&ldquo;Quazom,&rdquo; &ldquo;we,&rdquo;
                &ldquo;our,&rdquo; or &ldquo;us&rdquo;).
              </p>
              <p>
                By accessing or using the Service, you agree to be bound by
                these Terms. If you do not agree to these Terms, do not use the
                Service.
              </p>
            </>
          }
        />
        <LegalBody>
          <LegalSection id="eligibility" title="1. Eligibility">
            <p>You must be at least 13 years old to use Quazom.</p>
            <p>
              If you are under the age of majority in your jurisdiction, you
              represent that you have permission from a parent or legal guardian
              to use the Service.
            </p>
            <p>You may not use the Service if:</p>
            <LegalList>
              <LegalLi>
                doing so would violate any applicable law or regulation,
              </LegalLi>
              <LegalLi>
                you have previously been suspended or removed from the Service,
              </LegalLi>
              <LegalLi>
                or you are prohibited from receiving services under applicable
                law.
              </LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection id="description" title="2. Description of the Service">
            <p>
              Quazom is an AI-assisted educational and knowledge management
              platform designed to support self-directed learning, research,
              organization, and intellectual exploration.
            </p>
            <p>Features may include, but are not limited to:</p>
            <LegalList>
              <LegalLi>AI-assisted curriculum generation,</LegalLi>
              <LegalLi>lesson generation,</LegalLi>
              <LegalLi>quizzes and exercises,</LegalLi>
              <LegalLi>scheduling and progression tracking,</LegalLi>
              <LegalLi>note-taking,</LegalLi>
              <LegalLi>annotations and highlighting,</LegalLi>
              <LegalLi>continuity notes,</LegalLi>
              <LegalLi>interdisciplinary learning tools,</LegalLi>
              <LegalLi>research organization,</LegalLi>
              <LegalLi>transcription tools,</LegalLi>
              <LegalLi>text-to-speech generation,</LegalLi>
              <LegalLi>uploaded resource management,</LegalLi>
              <LegalLi>collaborative or social features,</LegalLi>
              <LegalLi>
                and other educational or productivity-related functionality.
              </LegalLi>
            </LegalList>
            <p>
              Some features may be experimental, in beta, incomplete, or subject
              to change.
            </p>
          </LegalSection>

          <LegalSection id="educational-disclaimer" title="3. Educational Disclaimer">
            <p>
              Quazom is provided for informational and educational assistance
              purposes only.
            </p>
            <p>Quazom:</p>
            <LegalList>
              <LegalLi>does not provide accredited education,</LegalLi>
              <LegalLi>does not issue degrees or certifications,</LegalLi>
              <LegalLi>does not guarantee educational outcomes,</LegalLi>
              <LegalLi>
                and is not a substitute for professional academic, medical,
                legal, financial, psychological, or other licensed advice.
              </LegalLi>
            </LegalList>
            <p>
              AI-generated content may contain inaccuracies, omissions,
              hallucinations, or outdated information. You are responsible for
              independently verifying important information.
            </p>
            <p>
              Your use of Quazom and reliance on any generated content is at
              your own risk.
            </p>
          </LegalSection>

          <LegalSection id="accounts" title="4. Accounts">
            <p>
              You may be required to create an account to access certain
              features.
            </p>
            <p>You agree to:</p>
            <LegalList>
              <LegalLi>provide accurate information,</LegalLi>
              <LegalLi>maintain the security of your account,</LegalLi>
              <LegalLi>
                and notify us immediately of any unauthorized access or use.
              </LegalLi>
            </LegalList>
            <p>
              You are responsible for all activity that occurs under your
              account.
            </p>
          </LegalSection>

          <LegalSection id="user-content" title="5. User Content">
            <p>
              &ldquo;User Content&rdquo; means any content you upload, create,
              submit, store, or transmit through Quazom, including:
            </p>
            <LegalList>
              <LegalLi>notes,</LegalLi>
              <LegalLi>annotations,</LegalLi>
              <LegalLi>uploaded files,</LegalLi>
              <LegalLi>curricula,</LegalLi>
              <LegalLi>prompts,</LegalLi>
              <LegalLi>research,</LegalLi>
              <LegalLi>transcripts,</LegalLi>
              <LegalLi>audio,</LegalLi>
              <LegalLi>messages,</LegalLi>
              <LegalLi>and other materials.</LegalLi>
            </LegalList>

            <LegalSubsection title="Ownership">
              <p>You retain ownership of your User Content.</p>
              <p>
                Quazom does not claim ownership over your notes, uploaded
                materials, research, or intellectual work.
              </p>
            </LegalSubsection>

            <LegalSubsection title="License to Quazom">
              <p>
                By using the Service, you grant Quazom a limited, non-exclusive,
                worldwide license to:
              </p>
              <LegalList>
                <LegalLi>host,</LegalLi>
                <LegalLi>store,</LegalLi>
                <LegalLi>process,</LegalLi>
                <LegalLi>reproduce,</LegalLi>
                <LegalLi>modify,</LegalLi>
                <LegalLi>and display your User Content</LegalLi>
              </LegalList>
              <p>solely for the purpose of:</p>
              <LegalList>
                <LegalLi>operating the Service,</LegalLi>
                <LegalLi>generating requested AI outputs,</LegalLi>
                <LegalLi>improving functionality,</LegalLi>
                <LegalLi>maintaining security,</LegalLi>
                <LegalLi>and providing the features you request.</LegalLi>
              </LegalList>
              <p>
                This license ends when your content is deleted from our active
                systems, subject to reasonable backup retention periods.
              </p>
            </LegalSubsection>
          </LegalSection>

          <LegalSection id="ai-content" title="6. AI-Generated Content">
            <p>Quazom may generate:</p>
            <LegalList>
              <LegalLi>curricula,</LegalLi>
              <LegalLi>lessons,</LegalLi>
              <LegalLi>summaries,</LegalLi>
              <LegalLi>quizzes,</LegalLi>
              <LegalLi>discussions,</LegalLi>
              <LegalLi>transcripts,</LegalLi>
              <LegalLi>synthesized audio,</LegalLi>
              <LegalLi>and other AI-generated outputs.</LegalLi>
            </LegalList>
            <p>
              Subject to applicable law and third-party provider policies, you
              retain rights to AI-generated outputs created for your account.
            </p>
            <p>You acknowledge that:</p>
            <LegalList>
              <LegalLi>generated content may not be unique,</LegalLi>
              <LegalLi>
                similar outputs may be generated for other users,
              </LegalLi>
              <LegalLi>
                and AI-generated materials may contain inaccuracies or
                unintended similarities.
              </LegalLi>
            </LegalList>
            <p>
              Quazom may use aggregated and anonymized usage data to improve
              platform performance and reliability.
            </p>
          </LegalSection>

          <LegalSection id="acceptable-use" title="7. Acceptable Use">
            <p>You agree not to:</p>
            <LegalList>
              <LegalLi>violate any applicable laws,</LegalLi>
              <LegalLi>infringe intellectual property rights,</LegalLi>
              <LegalLi>upload malicious code or malware,</LegalLi>
              <LegalLi>harass, abuse, threaten, or harm others,</LegalLi>
              <LegalLi>engage in hate speech or discriminatory conduct,</LegalLi>
              <LegalLi>exploit minors,</LegalLi>
              <LegalLi>distribute spam,</LegalLi>
              <LegalLi>scrape or reverse engineer the Service,</LegalLi>
              <LegalLi>
                attempt to extract system prompts or model configurations,
              </LegalLi>
              <LegalLi>interfere with platform security,</LegalLi>
              <LegalLi>
                or misuse the Service in ways that could harm Quazom or other
                users.
              </LegalLi>
            </LegalList>
            <p>You also agree not to use Quazom to:</p>
            <LegalList>
              <LegalLi>impersonate individuals or organizations,</LegalLi>
              <LegalLi>facilitate fraud,</LegalLi>
              <LegalLi>generate unlawful content,</LegalLi>
              <LegalLi>or conduct unauthorized automated access.</LegalLi>
            </LegalList>
            <p>
              We reserve the right to suspend or terminate accounts that violate
              these Terms.
            </p>
          </LegalSection>

          <LegalSection
            id="copyright"
            title="8. Uploaded Resources & Copyright"
          >
            <p>
              You represent that you have the necessary rights, permissions, or
              licenses to upload and use any content submitted to Quazom.
            </p>
            <p>You may not upload:</p>
            <LegalList>
              <LegalLi>pirated materials,</LegalLi>
              <LegalLi>unauthorized copyrighted works,</LegalLi>
              <LegalLi>
                or content you do not have the legal right to use.
              </LegalLi>
            </LegalList>
            <p>
              Quazom reserves the right to remove allegedly infringing content
              and comply with applicable copyright laws.
            </p>
            <p>
              If you believe content on Quazom infringes your copyright, you may
              submit a copyright or DMCA notice to{" "}
              <LegalEmail address="copyright@quazom.ai" />.
            </p>
          </LegalSection>

          <LegalSection
            id="billing"
            title="9. Subscription, Billing, and Usage Limits"
          >
            <p>
              Some features of Quazom may require payment or subscription
              access.
            </p>
            <p>By purchasing a subscription, you agree that:</p>
            <LegalList>
              <LegalLi>
                fees may recur automatically unless canceled,
              </LegalLi>
              <LegalLi>pricing may change with notice,</LegalLi>
              <LegalLi>
                and certain features may include usage limits or quotas.
              </LegalLi>
            </LegalList>
            <p>Quazom may impose:</p>
            <LegalList>
              <LegalLi>generation limits,</LegalLi>
              <LegalLi>storage limits,</LegalLi>
              <LegalLi>upload restrictions,</LegalLi>
              <LegalLi>or rate limits</LegalLi>
            </LegalList>
            <p>to protect platform stability and prevent abuse.</p>
            <p>
              Unless otherwise stated, payments are non-refundable except where
              required by law.
            </p>
          </LegalSection>

          <LegalSection id="beta" title="10. Beta Features & Availability">
            <p>Quazom is an evolving platform.</p>
            <p>You understand that:</p>
            <LegalList>
              <LegalLi>features may change or be removed,</LegalLi>
              <LegalLi>functionality may be incomplete,</LegalLi>
              <LegalLi>outages may occur,</LegalLi>
              <LegalLi>and generated outputs may vary over time.</LegalLi>
            </LegalList>
            <p>
              We do not guarantee uninterrupted or error-free operation of the
              Service.
            </p>
          </LegalSection>

          <LegalSection id="termination" title="11. Termination">
            <p>You may stop using Quazom at any time.</p>
            <p>We reserve the right to:</p>
            <LegalList>
              <LegalLi>suspend,</LegalLi>
              <LegalLi>restrict,</LegalLi>
              <LegalLi>or terminate access</LegalLi>
            </LegalList>
            <p>
              for users who violate these Terms or misuse the Service.
            </p>
            <p>We may also remove content that:</p>
            <LegalList>
              <LegalLi>violates applicable law,</LegalLi>
              <LegalLi>creates security risks,</LegalLi>
              <LegalLi>infringes intellectual property,</LegalLi>
              <LegalLi>or harms other users or the platform.</LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection id="privacy" title="12. Privacy">
            <p>
              Your use of Quazom is also governed by our{" "}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
              >
                Privacy Policy
              </Link>
              .
            </p>
            <p>
              By using the Service, you acknowledge that your information may be
              collected, stored, and processed as described in the Privacy
              Policy.
            </p>
          </LegalSection>

          <LegalSection id="third-party" title="13. Third-Party Services">
            <p>
              Quazom may rely on third-party providers and infrastructure
              services, including but not limited to:
            </p>
            <LegalList>
              <LegalLi>authentication providers,</LegalLi>
              <LegalLi>cloud hosting,</LegalLi>
              <LegalLi>analytics,</LegalLi>
              <LegalLi>payment processors,</LegalLi>
              <LegalLi>and AI model providers.</LegalLi>
            </LegalList>
            <p>
              We are not responsible for outages, errors, or policies of
              third-party services.
            </p>
          </LegalSection>

          <LegalSection id="ip" title="14. Intellectual Property">
            <p>
              The Quazom platform, branding, software, interfaces, and original
              platform content are owned by Quazom and protected by applicable
              intellectual property laws.
            </p>
            <p>Except as explicitly permitted, you may not:</p>
            <LegalList>
              <LegalLi>copy,</LegalLi>
              <LegalLi>distribute,</LegalLi>
              <LegalLi>modify,</LegalLi>
              <LegalLi>sell,</LegalLi>
              <LegalLi>
                or create derivative works from the Service itself.
              </LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection id="liability" title="15. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Quazom and its affiliates,
              employees, contractors, and licensors shall not be liable for:
            </p>
            <LegalList>
              <LegalLi>indirect damages,</LegalLi>
              <LegalLi>incidental damages,</LegalLi>
              <LegalLi>consequential damages,</LegalLi>
              <LegalLi>loss of profits,</LegalLi>
              <LegalLi>loss of data,</LegalLi>
              <LegalLi>educational outcomes,</LegalLi>
              <LegalLi>or reliance on AI-generated content.</LegalLi>
            </LegalList>
            <p>
              The Service is provided &ldquo;AS IS&rdquo; and &ldquo;AS
              AVAILABLE&rdquo; without warranties of any kind.
            </p>
          </LegalSection>

          <LegalSection id="indemnification" title="16. Indemnification">
            <p>
              You agree to indemnify and hold harmless Quazom and its affiliates
              from claims, damages, liabilities, and expenses arising from:
            </p>
            <LegalList>
              <LegalLi>your use of the Service,</LegalLi>
              <LegalLi>your User Content,</LegalLi>
              <LegalLi>your violation of these Terms,</LegalLi>
              <LegalLi>
                or your violation of applicable law or third-party rights.
              </LegalLi>
            </LegalList>
          </LegalSection>

          <LegalSection id="governing-law" title="17. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of the State of Delaware, without regard to conflict of
              law principles.
            </p>
          </LegalSection>

          <LegalSection id="changes" title="18. Changes to These Terms">
            <p>We may update these Terms from time to time.</p>
            <p>
              If material changes are made, we will provide reasonable notice
              through the Service or other appropriate means.
            </p>
            <p>
              Your continued use of Quazom after changes become effective
              constitutes acceptance of the updated Terms.
            </p>
          </LegalSection>

          <LegalSection id="contact" title="19. Contact">
            <p>
              If you have questions about these Terms, you may contact us at{" "}
              <LegalEmail address="legal@quazom.ai" />.
            </p>
          </LegalSection>

          <LegalSection id="philosophy" title="20. Philosophy of the Platform">
            <p>
              Quazom is designed to support curiosity, continuity of thought,
              interdisciplinary learning, and self-directed intellectual
              exploration.
            </p>
            <p>
              We believe your notes, ideas, research, and learning journeys
              belong to you.
            </p>
            <p>
              Quazom is intended to augment human learning and creativity — not
              replace human judgment, agency, or critical thinking.
            </p>
          </LegalSection>
        </LegalBody>
      </main>
      <SiteFooter />
    </div>
  );
}
