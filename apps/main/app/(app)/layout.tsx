import NavWrapper from "../../components/features/nav/nav-wrapper";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NavWrapper>{children}</NavWrapper>;
}
