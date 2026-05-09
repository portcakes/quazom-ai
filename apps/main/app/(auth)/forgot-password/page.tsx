import { requireGuest } from "@/lib/auth-utils";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  await requireGuest();
  return <ForgotPasswordForm />;
}
