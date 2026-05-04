"use client";

import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@quazom-ai/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@quazom-ai/ui/components/ui/dropdown-menu";
import {
  CalendarIcon,
  ChevronUpIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";

type UserMenuProps = {
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
};

export function UserMenu({ firstName, fullName, avatarUrl }: UserMenuProps) {
  const initials =
    fullName
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  // TODO: wire this up to the real session sign-out once auth is in place.
  // const handleLogout = async () => {
  //   await authClient.signOut();
  //   router.push("/login");
  // };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Open account menu for ${fullName}`}
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:outline-none aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground"
      >
        <Avatar size="sm">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-sm font-medium">{firstName}</span>
        <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        <DropdownMenuItem asChild>
          <Link href="/courses/new">
            <PlusIcon />
            <span>Create Course</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/schedule">
            <CalendarIcon />
            <span>View Schedule</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive">
          <LogOutIcon />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
