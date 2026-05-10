import { redirectIfAdmin } from "@/lib/auth-utils";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  await redirectIfAdmin();
  return <LoginForm />;
}
