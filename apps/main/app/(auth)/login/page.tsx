import { requireGuest } from "@/lib/auth-utils";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  await requireGuest();
  return <LoginForm />;
}
