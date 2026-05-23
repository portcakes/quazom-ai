import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@quazom-ai/db";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { polarClient } from "./polar";
import {
  sendEmailVerification,
  sendPasswordReset,
} from "@quazom-ai/emails";
import {
  onSubscriptionActive,
  onSubscriptionCanceled,
  onSubscriptionCreated,
  onSubscriptionRevoked,
  onSubscriptionUpdated,
} from "./subscription/webhook-handlers";
import { PLANS } from "./subscription/plans";

// Origins the Better Auth API is allowed to accept requests from. Anything not
// in this list (matched against the browser's `Origin` header) gets a 403
// `INVALID_ORIGIN` from the origin-check middleware. Wildcards are supported.
const trustedOrigins = [
    "https://app.quazom.ai",
    "http://localhost:3001",
    // Vercel preview deployments live under *.vercel.app
    "https://*.vercel.app",
];

// First word of the user's `name` column. Templates only ever address the
// recipient as "Hi <firstName>", so falling back to "there" keeps copy
// natural even when names are missing or weird.
function pickFirstName(name: string | null | undefined): string {
    if (!name) return "there";
    const trimmed = name.trim().split(/\s+/)[0];
    return trimmed && trimmed.length > 0 ? trimmed : "there";
}

// Default to 60 minutes — must be kept in sync with the literal we surface
// in the password-reset email body.
const RESET_PASSWORD_TOKEN_TTL_SECONDS = 60 * 60;

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    baseURL: process.env.BETTER_AUTH_URL,
    socialProviders: {
        google: {
            prompt: "select_account",
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
    account: {
        // Auto-link an incoming Google sign-in to an existing email/password
        // user when the email matches. Google always returns
        // `email_verified: true`, but listing it under `trustedProviders` is
        // belt-and-braces so a rare verified=false response still links.
        // `allowDifferentEmails` is restated as a guardrail against future
        // helpers cross-linking mismatched identities.
        accountLinking: {
            enabled: true,
            trustedProviders: ["google"],
            allowDifferentEmails: false,
        },
    },
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        // Block sign-in until the email is confirmed. Better Auth will
        // automatically re-send the verification email on each blocked sign-in
        // attempt, so there's no separate "resend" UI to wire up.
        requireEmailVerification: true,
        // 1 hour. The literal in the email body is computed from this.
        resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_TTL_SECONDS,
        // Belt-and-braces: nuke any other live sessions for this user when
        // they reset, so a stolen-cookie scenario doesn't survive a reset.
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => {
            const result = await sendPasswordReset({
                to: user.email,
                firstName: pickFirstName(user.name),
                resetUrl: url,
                expiresInMinutes: Math.round(
                    RESET_PASSWORD_TOKEN_TTL_SECONDS / 60,
                ),
            });
            if (!result.ok) {
                console.error(
                    "[auth] sendResetPassword failed",
                    result.error,
                );
            }
        },
    },
    emailVerification: {
        // Auto-fire the verification email immediately after signup so the
        // user never has to ask for it.
        sendOnSignUp: true,
        // After they click the link, drop them on /login with a flag so the
        // page can show a "you're verified, now sign in" toast.
        autoSignInAfterVerification: false,
        sendVerificationEmail: async ({ user, url }) => {
            const result = await sendEmailVerification({
                to: user.email,
                firstName: pickFirstName(user.name),
                verifyUrl: url,
            });
            if (!result.ok) {
                console.error(
                    "[auth] sendVerificationEmail failed",
                    result.error,
                );
            }
        },
    },
    trustedOrigins,
    plugins: [
        polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
                // Product slug catalogue is sourced from the same registry the
                // settings page renders so a price change is one edit away.
                checkout({
                    products: Object.values(PLANS).flatMap((plan) =>
                        (Object.entries(plan.pricing) as Array<
                            [
                                "MONTH" | "YEAR",
                                (typeof plan.pricing)["MONTH"],
                            ]
                        >).map(([, product]) => ({
                            productId: product.productId,
                            slug: product.slug,
                        })),
                    ),
                    successUrl: process.env.POLAR_SUCCESS_URL,
                    authenticatedUsersOnly: true,
                }),
                portal(),
                // POLAR_WEBHOOK_SECRET is required for the webhook plugin to
                // verify signatures. In dev we tolerate it being unset by
                // falling back to an empty string — the webhook endpoint
                // simply won't accept any payloads until it's configured,
                // which is what we want.
                webhooks({
                    secret: process.env.POLAR_WEBHOOK_SECRET ?? "",
                    onSubscriptionCreated,
                    onSubscriptionUpdated,
                    onSubscriptionActive,
                    onSubscriptionCanceled,
                    onSubscriptionRevoked,
                }),
            ]
        }),
    ],
});
