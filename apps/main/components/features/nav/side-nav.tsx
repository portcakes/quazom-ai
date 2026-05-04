import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@quazom-ai/ui/components/ui/sidebar";
import { HomeIcon, PanelLeftIcon } from "lucide-react";
import Link from "next/link";

export default function SideNav() {
    return (
        <Sidebar>
            <SidebarHeader>
                <SidebarTrigger>
                    <PanelLeftIcon />
                </SidebarTrigger>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/">
                                <HomeIcon />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    );
}