import Link from "next/link";
import { SidebarTrigger } from "@quazom-ai/ui/components/ui/sidebar";

export default function Navbar() {
    return (
        <nav className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
            <SidebarTrigger aria-label="Open navigation" />
            <Link
                href="/"
                className="font-heading text-lg font-bold tracking-tight"
            >
                Quazom
            </Link>
        </nav>
    );
}
