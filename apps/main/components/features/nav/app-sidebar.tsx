import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@quazom-ai/ui/components/ui/sidebar";
import type { CurrentUser } from "@/lib/queries/user";
import { UserMenu } from "./user-menu";
import { CourseList } from "../course-list/course-list";

type Props = {
  user: CurrentUser;
};

export default function AppSidebar({ user }: Props) {
  return (
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader className="px-4 py-4">
        <Link
          href="/"
          className="font-heading text-2xl font-bold tracking-tight hover:text-sidebar-accent-foreground"
        >
          Quazom
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent className="px-3 py-3">
        <CourseList />
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      <SidebarFooter className="p-0">
        <UserMenu
          firstName={user.firstName}
          fullName={user.fullName}
          avatarUrl={user.avatarUrl}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
