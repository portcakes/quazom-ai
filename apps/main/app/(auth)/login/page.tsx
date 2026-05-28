import { requireGuest } from "@/lib/auth-utils";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Quazom - Sign in to your account",
  description: "Sign in to your Quazom account to continue your personalized learning journey",
};

export default async function LoginPage() {
  await requireGuest();
  return <LoginForm />;
}
