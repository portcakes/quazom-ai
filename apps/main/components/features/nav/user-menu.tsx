"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  SettingsIcon,
  StickyNoteIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import NewCurriculumModal from "../new-curriculum-modal";

type UserMenuProps = {
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
};

export function UserMenu({ firstName, fullName, avatarUrl }: UserMenuProps) {
  const router = useRouter();

  const initials =
    fullName
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
        onError: (error) => {
          toast.error(error.error?.message ?? "Unable to sign out.");
        },
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Open account menu for ${fullName}`}
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent focus-visible:outline-none aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground cursor-pointer"
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
        <DropdownMenuItem asChild className="cursor-pointer">
          <NewCurriculumModal />
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/notes">
            <StickyNoteIcon />
            <span>Notes</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/schedule">
            <CalendarIcon />
            <span>Schedule</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings">
            <SettingsIcon />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer"
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
        >
          <LogOutIcon />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
