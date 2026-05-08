import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import prisma from "./db";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth"; 
import { Polar } from "@polar-sh/sdk";

// Origins the Better Auth API is allowed to accept requests from. Anything not
// in this list (matched against the browser's `Origin` header) gets a 403
// `INVALID_ORIGIN` from the origin-check middleware. Wildcards are supported.
const trustedOrigins = [
    "https://app.quazom.ai",
    "http://localhost:3001",
    // Vercel preview deployments live under *.vercel.app
    "https://*.vercel.app",
];

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
    },
    trustedOrigins,
});