import AppSidebar from "./app-sidebar";
import Navbar from "./navbar";
import {
    SidebarInset,
    SidebarProvider,
} from "@quazom-ai/ui/components/ui/sidebar";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { getUserCourses, getUserCurriculaCount } from "@/lib/queries/courses";
import { CourseListProvider } from "../course-list/course-list-provider";

export default async function NavWrapper({ children }: { children: React.ReactNode }) {
    await requireAuth();
    const [user, courses, totalCount] = await Promise.all([
        getCurrentUser(),
        getUserCourses(),
        getUserCurriculaCount(),
    ]);

    if (!user) {
        // requireAuth() above should have redirected, but bail out defensively.
        return null;
    }

    return (
        <CourseListProvider
            userId={user.id}
            initialCourses={courses}
            initialTotalCount={totalCount}
        >
            <SidebarProvider>
                <AppSidebar user={user} />
                <SidebarInset>
                    <Navbar />
                    {children}
                </SidebarInset>
            </SidebarProvider>
        </CourseListProvider>
    );
}
