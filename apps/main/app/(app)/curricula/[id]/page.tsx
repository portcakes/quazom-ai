import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth-utils";
import { getCurriculumById } from "@/lib/queries/curriculum";
import { CurriculumHero } from "@/components/features/curriculum/curriculum-hero";
import { CurriculumPending } from "@/components/features/curriculum/curriculum-pending";
import { CurriculumTabs } from "@/components/features/curriculum/curriculum-tabs";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const curriculum = await getCurriculumById(id);
  return {
    title: `Quazom - ${curriculum?.title ?? "Curriculum"}`,
    description: curriculum?.overview ?? "Your personalized curriculum",
  };
}

export default async function CurriculumPage({ params }: { params: Params }) {
  await requireAuth();
  const { id } = await params;

  const curriculum = await getCurriculumById(id);

  // Three states the page can land in:
  //   1. No row at all (legacy race, or the user is hitting a freshly minted
  //      id before the tRPC layer's `prisma.curriculum.create` commit) →
  //      hand off to the pending shell which polls.
  //   2. Row exists but status is PENDING / FAILED → render the pending
  //      shell which handles both (and surfaces a retry button on FAILED).
  //   3. Row is READY → render the full hero + tabs view.
  if (!curriculum) {
    return <CurriculumPending id={id} />;
  }
  if (curriculum.status !== "READY") {
    return <CurriculumPending id={id} initialKind={curriculum.kind} />;
  }

  return (
    <div className="flex min-w-0 flex-col">
      <CurriculumHero
        curriculumId={curriculum.id}
        title={curriculum.title}
        overview={curriculum.overview}
        estimatedDuration={curriculum.estimatedDuration}
        progress={curriculum.progress}
        kind={curriculum.kind}
        sources={curriculum.sources}
        thesis={curriculum.thesis}
      />
      <CurriculumTabs
        id={curriculum.id}
        title={curriculum.title}
        isHidden={curriculum.isHidden}
        objectives={curriculum.objectives}
        modules={curriculum.modules}
        resources={curriculum.recommendedResources}
        progress={curriculum.progress}
      />
    </div>
  );
}
