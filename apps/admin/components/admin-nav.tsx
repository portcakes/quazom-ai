"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GaugeIcon, UsersIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@quazom-ai/ui/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** True if `pathname` should match this item exactly rather than by prefix. */
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: GaugeIcon, exact: true },
  { href: "/users", label: "Users", icon: UsersIcon },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
