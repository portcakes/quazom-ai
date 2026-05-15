"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  LibraryIcon,
  LogOutIcon,
  PenSquareIcon,
  SettingsIcon,
  StickyNoteIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import NewCurriculumModal from "../new-curriculum-modal";
import { NoteEditorDialog } from "../notes/note-editor-dialog";
import { useSidebar } from "@quazom-ai/ui/components/ui/sidebar";
import { useTRPC } from "@/trpc/client";
import { titleLabel } from "@/lib/subscription/titles";

type UserMenuProps = {
  firstName: string;
  fullName: string;
  avatarUrl: string | null;
  /** Server-rendered fallback so first paint already shows the title. */
  selectedTitleLabel: string | null;
};

export function UserMenu({
  firstName,
  fullName,
  avatarUrl,
  selectedTitleLabel,
}: UserMenuProps) {
  // Pull the live profile so the displayed title updates the moment the
  // user picks a new one in Settings — without a full page refresh.
  const trpc = useTRPC();
  const profileQuery = useQuery(trpc.getProfile.queryOptions());
  const liveTitle = profileQuery.data?.selectedTitle
    ? titleLabel(profileQuery.data.selectedTitle)
    : null;
  const displayedTitle = liveTitle ?? selectedTitleLabel;
  const router = useRouter();
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  const { isMobile, setOpenMobile } = useSidebar();
  const optionsClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Run after a successful Quick Note / New Curriculum from the menu. On
  // mobile the off-canvas sidebar would otherwise stay on top of the new
  // content; collapsing it lets the user see what they just created.
  const closeMobileSidebar = () => {
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
        {/* The title sits beside the first name as a faded suffix —
            "Cayla, Founding Scholar" — so it reads as a personal byline
            rather than a noisy badge. We `min-w-0` the wrapper and clamp
            with truncate so a long display name still ellipses cleanly. */}
        <span className="flex min-w-0 flex-1 items-baseline gap-1 truncate text-left text-sm">
          <span className="truncate font-medium">{firstName}</span>
          {displayedTitle ? (
            <span className="truncate text-xs text-muted-foreground">
              , {displayedTitle}
            </span>
          ) : null}
        </span>
        <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        {/* New Curriculum: we keep the dropdown's default close behaviour
            (menu collapses on click) but DON'T eagerly close the mobile
            sidebar here. Closing the sidebar during the same tick the dialog
            mounts lets Radix interpret the sidebar-sheet's dismissal as an
            outside press on the dialog, which immediately closes the dialog
            again. The dialog itself fires `onCreated` after a successful
            submit, which is when we actually want the mobile sidebar gone. */}
        <DropdownMenuItem asChild className="cursor-pointer">
          <NewCurriculumModal onCreated={closeMobileSidebar} />
        </DropdownMenuItem>
        {/* Quick Note: opens the same dialog used elsewhere in the app, with
            no scope hints so the resulting note is free-form (homepage /
            notes-page style) rather than attached to a curriculum or
            lesson.

            We defer opening the dialog to the next tick (`setTimeout`) so the
            DropdownMenu finishes its dismissal first. Without the defer, the
            dropdown's outgoing "press outside" event fires after the dialog
            mounts and Radix Dialog treats it as an outside-press, closing the
            dialog immediately. */}
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            setTimeout(() => setQuickNoteOpen(true), 0);
          }}
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
          <Link href="/resources" onClick={optionsClick}>
            <LibraryIcon />
            <span>Resources</span>
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
    <NoteEditorDialog
      open={quickNoteOpen}
      onOpenChange={setQuickNoteOpen}
      onSaved={closeMobileSidebar}
    />
    </>
  );
}
