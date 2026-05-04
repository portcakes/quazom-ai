(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push(["chunks/[root-of-the-server]__05gaf4y._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[project]/sentry.edge.config.ts [instrumentation-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$edge$2f$index$2e$js__$5b$instrumentation$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@sentry/nextjs/build/esm/edge/index.js [instrumentation-edge] (ecmascript) <locals>");
;
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$edge$2f$index$2e$js__$5b$instrumentation$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__["init"]({
    dsn: "https://7908fbb175352765baf75d7629242c79@o4511326582013952.ingest.us.sentry.io/4511326591320064",
    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,
    // Enable logs to be sent to Sentry
    enableLogs: true,
    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true
});
}),
"[project]/instrumentation.ts [instrumentation-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "onRequestError",
    ()=>onRequestError,
    "register",
    ()=>register
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$common$2f$captureRequestError$2e$js__$5b$instrumentation$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@sentry/nextjs/build/esm/common/captureRequestError.js [instrumentation-edge] (ecmascript)");
globalThis["__SENTRY_SERVER_MODULES__"] = {
    "@quazom-ai/ui": "*",
    "@ai-sdk/google": "^3.0.67",
    "@base-ui/react": "^1.4.1",
    "@polar-sh/better-auth": "^1.8.3",
    "@polar-sh/sdk": "^0.46.7",
    "@prisma/adapter-neon": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "@sentry/nextjs": "^10.51.0",
    "@tanstack/react-query": "^5.100.8",
    "@trpc/client": "^11.17.0",
    "@trpc/server": "^11.17.0",
    "@trpc/tanstack-react-query": "^11.17.0",
    "ai": "^6.0.174",
    "better-auth": "^1.6.9",
    "class-variance-authority": "^0.7.1",
    "client-only": "^0.0.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "dotenv": "^17.4.2",
    "embla-carousel-react": "^8.6.0",
    "inngest": "^4.2.6",
    "input-otp": "^1.4.2",
    "lucide-react": "^1.14.0",
    "next": "16.2.4",
    "next-themes": "^0.4.6",
    "pg": "^8.20.0",
    "radix-ui": "^1.4.3",
    "react": "19.2.4",
    "react-day-picker": "^9.14.0",
    "react-dom": "19.2.4",
    "react-resizable-panels": "^4.10.0",
    "recharts": "^3.8.0",
    "server-only": "^0.0.1",
    "shadcn": "^4.6.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "vaul": "^1.1.2",
    "zod": "^4.4.2",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "prisma": "^7.8.0",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "typescript": "^5"
};
globalThis["_sentryNextJsVersion"] = "16.2.4";
globalThis["_sentryRewritesTunnelPath"] = "/monitoring";
;
async function register() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if ("TURBOPACK compile-time truthy", 1) {
        await Promise.resolve().then(()=>__turbopack_context__.i("[project]/sentry.edge.config.ts [instrumentation-edge] (ecmascript)"));
    }
}
const onRequestError = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$common$2f$captureRequestError$2e$js__$5b$instrumentation$2d$edge$5d$__$28$ecmascript$29$__["captureRequestError"];
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__05gaf4y._.js.map