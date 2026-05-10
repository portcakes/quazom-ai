import { createAuthClient } from "better-auth/react";

// `baseURL` is intentionally omitted: when the auth API is served from the
// same origin as the app (Next.js route handler at /api/auth/*), the React
// client falls back to `window.location.origin`, which is correct for
// localhost, previews, and production without per-env config.
export const authClient = createAuthClient();
