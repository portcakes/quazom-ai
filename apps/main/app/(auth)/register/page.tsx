import { requireGuest } from "@/lib/auth-utils";
import { RegisterForm } from "./register-form";

export const metadata = {
  title: "Quazom - Create your account",
  description: "Create your Quazom account to start your personalized learning journey",
};

export default async function RegisterPage() {
  await requireGuest();
  return <RegisterForm />;
}
