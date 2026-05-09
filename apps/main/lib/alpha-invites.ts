"use server";

import { z } from "zod";
import prisma from "@quazom-ai/db";

export type AlphaKeyValidationResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const inputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  accessKey: z.string().trim().min(1, "Please enter your alpha access key."),
});

// Server-only validator the register form calls before triggering the
// Better Auth signup. We deliberately don't *consume* the invite here —
// the consume step happens in the auth `databaseHooks.user.create.after`
// hook so a failed signup doesn't waste the key.
//
// Dev escape hatch: if `process.env.ALPHA_CODE` is set and the user submits
// it verbatim, we wave them through. This keeps local dev usable without
// having to mint a real invite for every test account.
export async function validateAlphaAccessKey(input: {
  email: string;
  accessKey: string;
}): Promise<AlphaKeyValidationResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const { email, accessKey } = parsed.data;

  const devCode = process.env.ALPHA_CODE;
  if (devCode && devCode.length > 0 && accessKey === devCode) {
    return { ok: true, email };
  }

  const invite = await prisma.alphaInvite.findUnique({
    where: { accessKey },
    select: {
      email: true,
      expiresAt: true,
      redeemedAt: true,
    },
  });

  if (!invite) {
    return { ok: false, error: "That alpha code isn't valid." };
  }
  if (invite.redeemedAt) {
    return {
      ok: false,
      error: "That alpha code has already been used.",
    };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error:
        "That alpha code has expired. Reply to your invite email and we'll send a new one.",
    };
  }
  if (invite.email.toLowerCase() !== email) {
    return {
      ok: false,
      error: "This alpha code was issued to a different email address.",
    };
  }
  return { ok: true, email };
}
