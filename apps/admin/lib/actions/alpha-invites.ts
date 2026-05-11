"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@quazom-ai/db";
import { sendAlphaInvite } from "@quazom-ai/emails";
import {
  generateAlphaAccessKey,
  getInviteTtlMs,
  getRegisterBaseUrl,
} from "@/inngest/alpha-keys";
import { requireAdmin } from "@/lib/auth-utils";

export type SendAlphaInviteResult =
  | { ok: true; sentTo: string; expiresAt: Date }
  | { ok: false; error: string };

const inputSchema = z.object({
  waitlistEntryId: z.string().min(1, "Missing waitlist entry id."),
});

/**
 * Admin-triggered "send alpha invite to this waitlist member" action.
 *
 * Behaviour mirrors the weekly cron in `inngest/functions.ts::weeklyAlphaInvites`:
 *   - mints a fresh QUAZOM-XXXX key with a 14-day TTL (configurable)
 *   - inserts an `AlphaInvite` row
 *   - calls Resend via `sendAlphaInvite`
 *   - on success, marks both the invite and the waitlist row as sent
 *   - on Resend failure, leaves the invite row as an audit trail with no
 *     `sentAt` and bubbles up the error so the admin UI can toast it
 *
 * Safety:
 *   - gated by `requireAdmin()` so a non-admin can't reach it even if they
 *     guess the action's hashed id
 *   - refuses to re-send if a User row already exists for that email
 *     (defence-in-depth — the client also greys the button out)
 */
export async function sendAlphaInviteToWaitlistEntry(input: {
  waitlistEntryId: string;
}): Promise<SendAlphaInviteResult> {
  await requireAdmin();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const { waitlistEntryId } = parsed.data;

  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: waitlistEntryId },
    select: { id: true, firstName: true, email: true },
  });
  if (!entry) {
    return { ok: false, error: "That waitlist entry no longer exists." };
  }

  // Hard guard: never email someone who already created an account. The
  // table-row button is also disabled in this state but we re-check here
  // so the action can't be racey/spoofed.
  const existingUser = await prisma.user.findUnique({
    where: { email: entry.email },
    select: { id: true },
  });
  if (existingUser) {
    return {
      ok: false,
      error: "This member already has a Quazom account.",
    };
  }

  const accessKey = generateAlphaAccessKey();
  const expiresAt = new Date(Date.now() + getInviteTtlMs());

  const invite = await prisma.alphaInvite.create({
    data: {
      id: randomUUID(),
      email: entry.email,
      accessKey,
      waitlistEntryId: entry.id,
      expiresAt,
    },
    select: { id: true, accessKey: true, expiresAt: true },
  });

  const registerUrl = `${getRegisterBaseUrl()}/register?key=${encodeURIComponent(
    invite.accessKey,
  )}`;

  const sendResult = await sendAlphaInvite({
    to: entry.email,
    firstName: entry.firstName,
    accessKey: invite.accessKey,
    registerUrl,
    expiresAt: invite.expiresAt,
  });

  if (!sendResult.ok) {
    // Keep the AlphaInvite row in the DB as an audit trail of the failed
    // send, but DO NOT mark the waitlist row as invited — the next click
    // (or the next cron tick) should try again.
    return {
      ok: false,
      error: `Failed to send invite email: ${sendResult.error}`,
    };
  }

  await prisma.$transaction([
    prisma.alphaInvite.update({
      where: { id: invite.id },
      data: { sentAt: new Date() },
    }),
    prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { invitedAt: new Date() },
    }),
  ]);

  // Re-render the /waitlist page so the row immediately reflects the new
  // invite status without the client needing a manual refresh.
  revalidatePath("/waitlist");

  return { ok: true, sentTo: entry.email, expiresAt: invite.expiresAt };
}
