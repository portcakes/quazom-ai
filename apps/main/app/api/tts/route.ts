import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { generateSpeech, TTS_MAX_INPUT_CHARS } from "@/lib/tts";
import { recordAiUsage } from "@/inngest/ai-usage";

// TTS calls hit a third-party HTTP API and return binary audio — there is
// nothing safe to prerender or cache here, so opt out explicitly.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TtsRequestBody = {
  text?: unknown;
  voice?: unknown;
};

/**
 * POST /api/tts
 *
 * Generates speech via Gemini TTS and streams the resulting WAV back to
 * the caller. The endpoint is auth-gated against the standard Better Auth
 * session — anonymous traffic is rejected before we make any model call,
 * which keeps the API key from being trivially proxied.
 *
 * Body: `{ text: string, voice?: string }`
 * Response: `audio/wav` binary on success.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const voice = typeof body.voice === "string" ? body.voice : undefined;
  if (!text.trim()) {
    return new Response("`text` is required", { status: 400 });
  }

  try {
    const result = await generateSpeech({ text, voice });

    // Best-effort usage accounting. Gemini's TTS preview API doesn't
    // always populate token counts, so we pass through whatever it gave
    // us — `recordAiUsage` tolerates missing fields.
    void recordAiUsage({
      userId: session.user.id,
      kind: "TTS",
      model: result.model,
      result: { usage: result.usage },
    });

    const headers = new Headers({
      "Content-Type": "audio/wav",
      "Content-Length": String(result.wav.length),
      // Per-user output, never share. Gives browsers permission to keep
      // the buffer in memory while the <audio> element is mounted but
      // forces a re-fetch on a fresh button press.
      "Cache-Control": "private, no-store",
      "X-TTS-Truncated": result.truncated ? "1" : "0",
      "X-TTS-Spoken-Chars": String(result.spokenChars),
      "X-TTS-Max-Chars": String(TTS_MAX_INPUT_CHARS),
    });
    // Buffer is a Node-only type; converting through Uint8Array gives the
    // Response constructor a Web-friendly BodyInit.
    return new Response(new Uint8Array(result.wav), { status: 200, headers });
  } catch (err) {
    console.error("[tts] failed to generate speech", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Failed to generate speech.";
    return new Response(message, { status: 502 });
  }
}
