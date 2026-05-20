import AppSidebar from "./app-sidebar";
import Navbar from "./navbar";
import {
    SidebarInset,
    SidebarProvider,
} from "@quazom-ai/ui/components/ui/sidebar";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { getUserCourses, getUserCurriculaCount } from "@/lib/queries/courses";
import { getUserContinuityNotes } from "@/lib/queries/continuity-notes";
import { CourseListProvider } from "../course-list/course-list-provider";
import { ContinuityNoteProvider } from "../continuity-notes/continuity-note-provider";
import { ContinuityNotePanel } from "../continuity-notes/continuity-note-panel";

export default async function NavWrapper({ children }: { children: React.ReactNode }) {
    await requireAuth();
    const [user, courses, totalCount, continuityNotes] = await Promise.all([
        getCurrentUser(),
        getUserCourses(),
        getUserCurriculaCount(),
        getUserContinuityNotes(),
    ]);

    if (!user) {
        // requireAuth() above should have redirected, but bail out defensively.
        return null;
    }

    // Serialise dates to ISO strings before handing the list to the client
    // provider. The tRPC query that backs the live list returns Date
    // instances (deserialised by SuperJSON-style hydration), but the
    // server-rendered initialData is plain JSON that crosses the boundary
    // as strings — we mirror that shape here so the types line up.
    const initialContinuityNotes = continuityNotes.map((note) => ({
        id: note.id,
        title: note.title,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
    }));

    return (
        <CourseListProvider
            userId={user.id}
            initialCourses={courses}
            initialTotalCount={totalCount}
        >
            <ContinuityNoteProvider initialNotes={initialContinuityNotes}>
                <SidebarProvider>
                    <AppSidebar user={user} />
                    <SidebarInset>
                        <Navbar />
                        {/* Split-screen wrapper: the main page content
                            shrinks to fit on the left while the
                            ContinuityNotePanel claims a fixed-width
                            column on the right when a note is open. */}
                        <div className="flex flex-1 min-h-0 min-w-0">
                            <div className="flex-1 min-w-0 flex flex-col">
                                {children}
                            </div>
                            <ContinuityNotePanel />
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </ContinuityNoteProvider>
        </CourseListProvider>
    );
}
