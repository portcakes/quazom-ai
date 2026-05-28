import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Quazom - Reset your password",
  description: "Reset your Quazom password to continue your personalized learning journey",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const rawError = params.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;
  return <ResetPasswordForm token={token ?? null} initialError={error ?? null} />;
}
