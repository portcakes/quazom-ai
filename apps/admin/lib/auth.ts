import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@quazom-ai/db";

// Admin Better Auth instance. Shares the same Postgres DB as apps/main (so a
// user's email/password credentials work in both places) but uses a separate
// `BETTER_AUTH_SECRET` so a leak of the main app's secret can't forge an
// admin session. We deliberately do NOT enable user-facing flows here —
// signup, email verification, and password reset all live on apps/main.
// Admins reuse the credentials they already created over there.
const trustedOrigins = [
  "https://admin.quazom.ai",
  "http://localhost:3003",
  "https://*.vercel.app",
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    // Skip the email-verification gate that apps/main enforces: anyone with
    // `isAdmin = true` in the DB has by definition already been onboarded
    // through the main app, so verification has already happened there.
    requireEmailVerification: false,
    // Self-serve signup is disabled. Admin rows are created by flipping
    // `isAdmin` to true on an existing user in the database.
    disableSignUp: true,
  },
  trustedOrigins,
});
