"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import prisma from "@quazom-ai/db";
import { sendWaitlistWelcome } from "@quazom-ai/emails";

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

  let entry: { id: string; welcomeEmailSentAt: Date | null };
  try {
    // Upsert so a user that submits on both the homepage and the dedicated
    // /waitlist page just gets their entry refreshed (and `source` updated to
    // wherever they last engaged). We then conditionally send the welcome
    // email below — only on first-ever submission, never on duplicates.
    entry = await prisma.waitlistEntry.upsert({
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
      select: { id: true, welcomeEmailSentAt: true },
    });
  } catch (err) {
    console.error("[waitlist] failed to save entry", err);
    return {
      ok: false,
      error: "Something went wrong on our end. Please try again in a moment.",
    };
  }

  // Fire the welcome email only on a brand-new entry. We mark the row as
  // "sent" *first* so a flaky retry can't double-send if the action runs
  // twice (browser back, double-click, etc.). If the send itself fails we
  // log and continue — the user is on the list either way and we'd rather
  // succeed quietly than show them an error for a missed email.
  if (!entry.welcomeEmailSentAt) {
    const sentAt = new Date();
    try {
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { welcomeEmailSentAt: sentAt },
      });
      const result = await sendWaitlistWelcome({
        to: email,
        firstName,
      });
      if (!result.ok) {
        console.error("[waitlist] welcome email failed", result.error);
        await prisma.waitlistEntry
          .update({
            where: { id: entry.id },
            data: { welcomeEmailSentAt: null },
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("[waitlist] welcome email threw", err);
    }
  }

  return { ok: true };
}
