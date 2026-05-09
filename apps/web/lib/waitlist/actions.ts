"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import prisma from "@quazom-ai/db";

export type WaitlistSource = "homepage" | "waitlist-page";

export type WaitlistJoinResult =
  | { ok: true }
  | { ok: false; error: string; field?: "firstName" | "email" };

const waitlistInputSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Please tell us your first name.")
    .max(80, "That name is a little long—try a shorter version."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
  source: z.enum(["homepage", "waitlist-page"]),
});

export async function joinWaitlist(input: {
  firstName: string;
  email: string;
  source: WaitlistSource;
}): Promise<WaitlistJoinResult> {
  const parsed = waitlistInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      ok: false,
      error: issue?.message ?? "Please check the form and try again.",
      field: field === "firstName" || field === "email" ? field : undefined,
    };
  }

  const { firstName, email, source } = parsed.data;

  try {
    // Upsert so a user that submits on both the homepage and the dedicated
    // /waitlist page just gets their entry refreshed (and `source` updated to
    // wherever they last engaged).
    await prisma.waitlistEntry.upsert({
      where: { email },
      create: {
        id: randomUUID(),
        firstName,
        email,
        source,
      },
      update: {
        firstName,
        source,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[waitlist] failed to save entry", err);
    return {
      ok: false,
      error: "Something went wrong on our end. Please try again in a moment.",
    };
  }
}
