import "server-only";

import { createHash } from "node:crypto";

/**
 * Wrapper around the Gemini TTS REST API. The `@ai-sdk/google` provider we
 * use elsewhere doesn't yet expose audio-out, so we hit the
 * `generativelanguage.googleapis.com` endpoint directly and receive raw
 * 16-bit PCM as base64 inline data. This file owns the request shaping,
 * markdown→spoken-text cleaning, and the bit of WAV-header math needed to
 * make the bytes playable in a browser via a normal `<audio>` element.
 */

// `gemini-2.5-flash-preview-tts` is the cheapest, lowest-latency single-
// speaker TTS model on the public Gemini API. It returns 16-bit signed
// little-endian PCM at 24kHz mono — see the `audio/L16;codec=pcm;rate=24000`
// `mimeType` on the response. We hard-code those parameters into the WAV
// header below; if you swap to another voice/model and the rate changes,
// re-derive the header from the response `mimeType` instead of trusting
// these constants.
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const SAMPLE_RATE_HZ = 24_000;
const SAMPLE_BITS = 16;
const NUM_CHANNELS = 1;

// Default voice. "Kore" is the warm, neutral voice Gemini docs use as a
// reference. Override via the `voice` argument to switch up tone — see
// the voice gallery at https://ai.google.dev/gemini-api/docs/speech-generation#voices.
export const DEFAULT_TTS_VOICE = "Kore";

/** Hard cap so a runaway "speak the whole reading" doesn't melt the bill or
 *  hit Gemini's preview-tier audio length cap. ~5,000 chars maps to roughly
 *  3-4 minutes of audio, which is plenty for an overview block while still
 *  letting a moderate-length article through whole. */
export const TTS_MAX_INPUT_CHARS = 25_000;

export type GenerateSpeechResult = {
  /** Ready-to-stream WAV bytes (PCM body wrapped in a RIFF header). */
  wav: Buffer;
  /** True if we silently truncated the input to {@link TTS_MAX_INPUT_CHARS}. */
  truncated: boolean;
  /** Char count we actually sent to the API after cleaning + truncating. */
  spokenChars: number;
  /** Length of the rendered audio in seconds, derived from the PCM body
   *  size. Best-effort — `null` if the response didn't carry PCM data we
   *  could measure. */
  durationSeconds: number | null;
  /** Raw token usage from the model response (best-effort; preview API can
   *  omit fields). Used for `recordAiUsage`. */
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  /** Echo of the model id we called so usage rows stay accurate if we
   *  bump the constant later. */
  model: string;
};

/**
 * Compute the dedup key for a (text, voice, model) tuple. Stable across
 * processes — we use it to look up an existing GeneratedAudio row before
 * spending another model call. The cleaned text goes through
 * {@link stripMarkdownForSpeech} first so identical passages with
 * different surrounding markdown still hash to the same key.
 */
export function ttsContextKey(opts: {
  text: string;
  voice?: string;
}): string {
  const cleaned = stripMarkdownForSpeech(opts.text);
  const truncated = cleaned.slice(0, TTS_MAX_INPUT_CHARS);
  const voice = opts.voice || DEFAULT_TTS_VOICE;
  return createHash("sha256")
    .update(`${TTS_MODEL}\u241F${voice}\u241F${truncated}`, "utf8")
    .digest("hex");
}

type GeminiInlineData = {
  data?: string;
  mimeType?: string;
};

type GeminiPart = {
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
};

type GeminiCandidate = {
  content?: { parts?: GeminiPart[] };
};

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
};

/**
 * Generate spoken audio for the given block of text via Gemini TTS.
 *
 * Throws `Error` with a user-safe message on misconfiguration, API errors,
 * or empty responses — the route handler turns those into 4xx/5xx
 * responses, so callers can `try/catch` and surface them verbatim.
 */
export async function generateSpeech({
  text,
  voice = DEFAULT_TTS_VOICE,
}: {
  text: string;
  voice?: string;
}): Promise<GenerateSpeechResult> {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Text-to-speech is not configured on this server.");
  }

  const cleaned = stripMarkdownForSpeech(text);
  if (!cleaned) {
    throw new Error("Nothing to read aloud.");
  }
  const truncated = cleaned.length > TTS_MAX_INPUT_CHARS;
  const spoken = truncated ? cleaned.slice(0, TTS_MAX_INPUT_CHARS) : cleaned;

  // Gemini TTS won't actually generate audio unless the prompt is phrased
  // as an instruction (the preview model treats bare text as a no-op). The
  // "Read this aloud" prefix is the canonical workaround from the Gemini
  // cookbook examples.
  const promptText = `Read this aloud in a clear, neutral, conversational voice:\n\n${spoken}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    TTS_MODEL,
  )}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await safeReadError(response);
    throw new Error(
      `Gemini TTS request failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  const json = (await response.json()) as GeminiResponse;
  const part = json.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data || p.inline_data?.data,
  );
  const inlineData = part?.inlineData ?? part?.inline_data;
  const base64 = inlineData?.data;
  if (!base64) {
    throw new Error("Gemini TTS returned no audio for this passage.");
  }

  const pcm = Buffer.from(base64, "base64");
  const wav = wrapPcmInWav(pcm, {
    sampleRate: SAMPLE_RATE_HZ,
    bitsPerSample: SAMPLE_BITS,
    numChannels: NUM_CHANNELS,
  });

  // PCM length / (sample rate * channels * bytes-per-sample) → seconds.
  // For our 24kHz/16-bit/mono stream that's `pcm.length / (24000 * 2)`.
  const bytesPerSecond = SAMPLE_RATE_HZ * NUM_CHANNELS * (SAMPLE_BITS / 8);
  const durationSeconds = pcm.length > 0 ? pcm.length / bytesPerSecond : null;

  const usage = json.usageMetadata ?? {};
  return {
    wav,
    truncated,
    spokenChars: spoken.length,
    durationSeconds,
    usage: {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
    },
    model: TTS_MODEL,
  };
}

async function safeReadError(response: Response): Promise<string | null> {
  try {
    const body = await response.json();
    const msg =
      typeof body === "object" && body !== null && "error" in body
        ? // Gemini errors come as { error: { message, status } }
          ((body as { error?: { message?: string } }).error?.message ?? null)
        : null;
    return msg;
  } catch {
    try {
      return (await response.text()).slice(0, 200);
    } catch {
      return null;
    }
  }
}

/**
 * Reduce markdown to something a TTS model can read aloud cleanly. We
 * deliberately don't run this through a full parser — we just want to keep
 * Gemini from saying "asterisk asterisk" or pronouncing URLs out loud.
 *
 * Order matters: code fences first so we don't accidentally strip the `#`
 * in a code block heading, links before emphasis so the URL is dropped
 * before its surrounding underscores get touched.
 */
export function stripMarkdownForSpeech(input: string): string {
  if (!input) return "";
  let out = input;

  // Drop fenced code blocks entirely — code rarely makes sense as audio.
  out = out.replace(/```[\s\S]*?```/g, " ");
  // Inline code: keep the contents but drop the backticks.
  out = out.replace(/`([^`]+)`/g, "$1");

  // Images ![alt](url) → alt
  out = out.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // Links [text](url) → text
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Reference-style links [text][id] → text
  out = out.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  // Bare angle-bracket URLs: drop them.
  out = out.replace(/<https?:\/\/[^>]+>/g, " ");

  // ATX headings: strip leading #'s, keep the heading text.
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Setext headings: drop the underline rule beneath.
  out = out.replace(/^\s{0,3}(?:=+|-+)\s*$/gm, "");

  // Blockquotes / list bullets at line start.
  out = out.replace(/^\s{0,3}>\s?/gm, "");
  out = out.replace(/^\s{0,3}[-*+]\s+/gm, "");
  out = out.replace(/^\s{0,3}\d+\.\s+/gm, "");

  // Emphasis markers. Two passes so **bold** doesn't get half-stripped.
  out = out.replace(/(\*\*|__)(.*?)\1/g, "$2");
  out = out.replace(/(\*|_)(?=\S)(.*?)\1/g, "$2");

  // Strikethrough.
  out = out.replace(/~~([^~]+)~~/g, "$1");

  // Stray HTML tags (rare in our content but we render rehype-raw notes,
  // so be defensive).
  out = out.replace(/<\/?[a-z][^>]*>/gi, " ");

  // Collapse whitespace — multiple newlines become a single sentence break
  // so TTS rhythm stays natural.
  out = out.replace(/\r/g, "");
  out = out.replace(/\u00A0/g, " ");
  out = out.replace(/\n{2,}/g, ". ");
  out = out.replace(/\n+/g, " ");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\s+([.,;:!?])/g, "$1");
  out = out.replace(/\.{2,}/g, ".");

  return out.trim();
}

/**
 * Wrap a raw PCM body in a RIFF/WAVE container so browsers will play it.
 *
 * Gemini hands back `audio/L16;codec=pcm;rate=24000` — that's headerless
 * 16-bit signed little-endian PCM at 24kHz mono. Browsers won't play that
 * MIME type directly, so we prepend the standard 44-byte WAV header and
 * serve the result as `audio/wav`.
 */
function wrapPcmInWav(
  pcm: Buffer,
  opts: { sampleRate: number; bitsPerSample: number; numChannels: number },
): Buffer {
  const { sampleRate, bitsPerSample, numChannels } = opts;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  // RIFF chunk descriptor.
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8, "ascii");
  // "fmt " sub-chunk.
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  // "data" sub-chunk.
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm], header.length + pcm.length);
}
