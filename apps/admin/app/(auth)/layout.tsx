import { ShieldCheckIcon } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheckIcon className="size-4 text-primary" />
          <span className="font-heading text-base font-bold tracking-tight text-foreground">
            Quazom
          </span>
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Admin
          </span>
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-20 sm:py-24">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
