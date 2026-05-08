import { createAuthClient } from "better-auth/react";
import { polarClient } from "@polar-sh/better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

// `baseURL` is intentionally omitted: when the auth API is served from the
// same origin as the app (our setup — Next.js route handler at /api/auth/*),
// the React client uses `window.location.origin`, which is what we want for
// production, previews, and localhost without per-environment config.
//
// `dotenv/config` was removed: it's a Node-only module and `process.env.*`
// non-NEXT_PUBLIC_* vars are not inlined into client bundles in Next.js, so
// reading `BETTER_AUTH_URL` here resolved to `undefined` anyway.
export const authClient = createAuthClient({
    plugins: [
        polarClient(),
        organizationClient(),
    ],
});