import NavWrapper from "../../components/features/nav/nav-wrapper";
import { CheckoutIntentLauncher } from "@/components/auth/checkout-intent-launcher";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavWrapper>
      {children}
      <CheckoutIntentLauncher />
    </NavWrapper>
  );
}
