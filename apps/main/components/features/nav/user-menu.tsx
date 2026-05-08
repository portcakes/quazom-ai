"use client";

import Link from "next/link";
import { useState } from "react";
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
  PenSquareIcon,
  SettingsIcon,
  StickyNoteIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import NewCurriculumModal from "../new-curriculum-modal";
import { NoteEditorDialog } from "../notes/note-editor-dialog";
import { useSidebar } from "@quazom-ai/ui/components/ui/sidebar";

type UserMenuProps = {
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
};

export function UserMenu({ firstName, fullName, avatarUrl }: UserMenuProps) {
  const router = useRouter();
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  const { isMobile, setOpenMobile } = useSidebar();
  const optionsClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

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
    <>
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
        {/* Quick Note: opens the same dialog used elsewhere in the app, with
            no scope hints so the resulting note is free-form (homepage /
            notes-page style) rather than attached to a curriculum or
            lesson. We let the dropdown close on select; the dialog state is
            independent so it stays open after the menu dismisses. */}
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => setQuickNoteOpen(true)}
          onClick={optionsClick}
        >
          <PenSquareIcon />
          <span>Quick note</span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/notes" onClick={optionsClick}>
            <StickyNoteIcon />
            <span>Notes</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/schedule" onClick={optionsClick}>
            <CalendarIcon />
            <span>Schedule</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings" onClick={optionsClick}>
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
    <NoteEditorDialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen} />
    </>
  );
}
