import prisma from "@quazom-ai/db";
import type { AiUsageKind } from "@quazom-ai/db/enums";

/**
 * Shape returned by the Vercel AI SDK on `generateObject` / `generateText`
 * results. We're permissive about field names so older/newer SDK versions
 * with subtly different keys both land in the same column.
 */
type RawUsage = {
  // AI SDK v6+ canonical field names
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  // Older AI SDK aliases — kept for safety if a function pins an older version
  promptTokens?: number;
  completionTokens?: number;
};

type AiResultLike = {
  usage?: RawUsage;
};

type RecordAiUsageInput = {
  userId: string;
  kind: AiUsageKind;
  model: string;
  result: AiResultLike;
  /** Optional id of the entity this call was made against. */
  resourceId?: string;
};

/**
 * Persists an `ai_usage` row for a single LLM call. Designed to be best-effort:
 * any failure is swallowed (with a console.error) so token accounting can
 * never cause a primary user flow to fail. The admin dashboard tolerates
 * occasional gaps in the data.
 */
export async function recordAiUsage({
  userId,
  kind,
  model,
  result,
  resourceId,
}: RecordAiUsageInput): Promise<void> {
  try {
    const usage = result.usage ?? {};
    const input = pickFirstFinite(usage.inputTokens, usage.promptTokens) ?? 0;
    const output =
      pickFirstFinite(usage.outputTokens, usage.completionTokens) ?? 0;
    const total = pickFirstFinite(usage.totalTokens) ?? input + output;

    await prisma.aiUsage.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        kind,
        model,
        inputTokens: input,
        outputTokens: output,
        totalTokens: total,
        resourceId: resourceId ?? null,
      },
    });
  } catch (err) {
    console.error("[ai-usage] failed to record usage row", err);
  }
}

function pickFirstFinite(...candidates: Array<number | undefined>): number | undefined {
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }
  }
  return undefined;
}
