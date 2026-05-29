import AppSidebar from "./app-sidebar";
import Navbar from "./navbar";
import { SidebarEdgeGesture } from "./sidebar-edge-gesture";
import {
    SidebarInset,
    SidebarProvider,
} from "@quazom-ai/ui/components/ui/sidebar";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { getUserCourses, getUserCurriculaCount } from "@/lib/queries/courses";
import {
  getUserSandboxSummaries,
  getUserSandboxesCount,
} from "@/lib/queries/sandbox";
import { getUserContinuityNotes } from "@/lib/queries/continuity-notes";
import { CourseListProvider } from "../course-list/course-list-provider";
import { ContinuityNoteProvider } from "../continuity-notes/continuity-note-provider";
import { ContinuityNotePanel } from "../continuity-notes/continuity-note-panel";
import { AudioPlayerProvider } from "../audio-player/audio-player-provider";
import { AudioPlayerBar } from "../audio-player/audio-player-bar";
import { ThemeSync } from "@/components/shared/theme-sync";

export default async function NavWrapper({ children }: { children: React.ReactNode }) {
    await requireAuth();
    const [
        user,
        courses,
        curriculaCount,
        sandboxes,
        sandboxCount,
        continuityNotes,
    ] = await Promise.all([
        getCurrentUser(),
        getUserCourses(),
        getUserCurriculaCount(),
        getUserSandboxSummaries(),
        getUserSandboxesCount(),
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
        tags: note.tags ?? [],
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
    }));

    return (
        <CourseListProvider
            userId={user.id}
            initialCourses={courses}
            initialSandboxes={sandboxes}
            initialTotalCount={curriculaCount + sandboxCount}
        >
            <ContinuityNoteProvider initialNotes={initialContinuityNotes}>
                <AudioPlayerProvider>
                    <SidebarProvider>
                        <ThemeSync />
                        <SidebarEdgeGesture />
                        <AppSidebar user={user} />
                        {/* `min-w-0` keeps SidebarInset from claiming
                            a horizontal min-width based on its
                            children's intrinsic min-content (otherwise
                            the 480px continuity-note panel + the lesson
                            page's unshrinkable buttons can push the
                            inset wider than its flex allocation, which
                            then overflows the page and lets the user
                            scroll horizontally — the fixed sidebar
                            stays put while sticky elements drift left
                            over it). `overflow-x-clip` is a belt-and-
                            suspenders guarantee that any internal
                            horizontal overflow (e.g. a wide code block
                            in a lesson) is clipped here instead of
                            bubbling up to the body. `clip` doesn't
                            create a scroll container, so the audio
                            bar's sticky positioning still anchors to
                            the viewport. */}
                        <SidebarInset className="min-w-0 overflow-x-clip">
                            <Navbar />
                            {/* Audio player bar sits between the navbar
                                and the main content. It's sticky inside
                                the SidebarInset's scroll container so it
                                tucks under the navbar as the user
                                scrolls. The provider above keeps the
                                <audio> element mounted across page
                                navigations so playback never stops. */}
                            <AudioPlayerBar />
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
                </AudioPlayerProvider>
            </ContinuityNoteProvider>
        </CourseListProvider>
    );
}
