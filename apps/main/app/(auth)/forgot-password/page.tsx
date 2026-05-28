import { requireGuest } from "@/lib/auth-utils";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Quazom - Forgot your password?",
  description: "Reset your Quazom password to continue your personalized learning journey",
};

export default async function ForgotPasswordPage() {
  await requireGuest();
  return <ForgotPasswordForm />;
}
