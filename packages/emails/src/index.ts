import * as React from "react";
import { getFromAddress, getReplyToAddress, getResend } from "./client";
import {
  WaitlistWelcome,
  type WaitlistWelcomeProps,
} from "./templates/waitlist-welcome";
import {
  AlphaInvite,
  type AlphaInviteProps,
} from "./templates/alpha-invite";
import {
  EmailVerification,
  type EmailVerificationProps,
} from "./templates/email-verification";
import {
  PasswordReset,
  type PasswordResetProps,
} from "./templates/password-reset";

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

type SendOptions = {
  to: string;
  // Optional: override the from / replyTo on a per-call basis. Falls back to
  // the env-driven defaults from `client.ts`.
  from?: string;
  replyTo?: string;
};

async function send({
  to,
  subject,
  react,
  from,
  replyTo,
  tags,
}: SendOptions & {
  subject: string;
  react: React.ReactElement;
  tags?: { name: string; value: string }[];
}): Promise<SendResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: from ?? getFromAddress(),
      to,
      replyTo: replyTo ?? getReplyToAddress(),
      subject,
      react,
      tags,
    });
    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Resend returned no data.",
      };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sendWaitlistWelcome(
  options: SendOptions & WaitlistWelcomeProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...props } = options;
  return send({
    to,
    from,
    replyTo,
    subject: `You're on the Quazom waitlist, ${props.firstName}`,
    react: React.createElement(WaitlistWelcome, props),
    tags: [{ name: "category", value: "waitlist_welcome" }],
  });
}

export async function sendAlphaInvite(
  options: SendOptions & AlphaInviteProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...props } = options;
  return send({
    to,
    from,
    replyTo,
    subject: `Your Quazom alpha invite is ready, ${props.firstName}`,
    react: React.createElement(AlphaInvite, props),
    tags: [{ name: "category", value: "alpha_invite" }],
  });
}

export async function sendEmailVerification(
  options: SendOptions & EmailVerificationProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...props } = options;
  return send({
    to,
    from,
    replyTo,
    subject: "Verify your email for Quazom",
    react: React.createElement(EmailVerification, props),
    tags: [{ name: "category", value: "email_verification" }],
  });
}

export async function sendPasswordReset(
  options: SendOptions & PasswordResetProps,
): Promise<SendResult> {
  const { to, from, replyTo, ...props } = options;
  return send({
    to,
    from,
    replyTo,
    subject: "Reset your Quazom password",
    react: React.createElement(PasswordReset, props),
    tags: [{ name: "category", value: "password_reset" }],
  });
}

export {
  WaitlistWelcome,
  AlphaInvite,
  EmailVerification,
  PasswordReset,
};
export type {
  WaitlistWelcomeProps,
  AlphaInviteProps,
  EmailVerificationProps,
  PasswordResetProps,
};
export { getResend, getFromAddress, getReplyToAddress } from "./client";
