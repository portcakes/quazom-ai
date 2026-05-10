import Link from "next/link";
import { ShieldCheckIcon } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import type { AdminUser } from "@/lib/auth-utils";
import { AdminNav } from "./admin-nav";

type Props = {
  user: AdminUser;
  children: React.ReactNode;
};

/**
 * Top-level chrome for every admin page. A single sticky header carries the
 * brand, primary navigation, the signed-in admin's name, and the sign-out
 * button. The actual page content is rendered into a max-width content well
 * underneath. We deliberately keep the layout single-column (no sidebar) —
 * the admin has only a handful of routes, and a horizontal nav reads
 * cleaner at the small density we have.
 */
export function AdminShell({ user, children }: Props) {
  const initials = pickInitials(user.name, user.email);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-foreground transition-colors hover:text-primary"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                <ShieldCheckIcon className="size-4" />
              </span>
              <span className="font-heading text-lg font-bold tracking-tight">
                Quazom
              </span>
              <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                Admin
              </span>
            </Link>
            <AdminNav />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end leading-tight sm:flex">
              <span className="text-sm font-medium text-foreground">
                {user.name || user.email}
              </span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </div>
            <span
              aria-hidden
              className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-heading text-xs font-bold"
            >
              {initials}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-border/60 bg-card/30">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3 text-xs text-muted-foreground">
          <span>Quazom internal · admin console</span>
          <span>© {new Date().getFullYear()} Quazom</span>
        </div>
      </footer>
    </div>
  );
}

function pickInitials(name: string, email: string): string {
  const source = name?.trim() ? name : email;
  return (
    source
      .split(/[\s@]+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}
