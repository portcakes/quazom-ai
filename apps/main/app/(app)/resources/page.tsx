import { requireAuth } from "@/lib/auth-utils";
import { ResourcesGrid } from "@/components/features/resources/resources-grid";
import { AudioLibrarySection } from "@/components/features/audio-player/audio-library-section";

export const metadata = {
  title: "Quazom - Resources",
  description: "Your collection of resources",
};

export default async function ResourcesPage() {
  await requireAuth();

  return (
    <div className="flex min-w-0 flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 md:gap-4 md:py-12">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your Resources
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Upload PDFs, markdown notes, and plain-text references, or save
            links to articles and wikis. Open any resource to read it,
            highlight passages, and pull quotes into a note.
          </p>
        </div>
      </section>
      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        <ResourcesGrid scopeLabel="Personal collection" />
      </section>
      {/* TTS audio library — same underlying data the audio player bar
          surfaces, but rendered inline so users have a primary surface to
          manage their generated clips. */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-12">
        <AudioLibrarySection />
      </section>
    </div>
  );
}
