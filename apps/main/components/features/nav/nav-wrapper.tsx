import AppSidebar from "./app-sidebar";
import Navbar from "./navbar";
import {
    SidebarInset,
    SidebarProvider,
} from "@quazom-ai/ui/components/ui/sidebar";

export default function NavWrapper({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <Navbar />
                {children}
            </SidebarInset>
        </SidebarProvider>
    );
}
