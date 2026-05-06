import { requireGuest } from "@/lib/auth-utils";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  await requireGuest();
  return <RegisterForm />;
}
