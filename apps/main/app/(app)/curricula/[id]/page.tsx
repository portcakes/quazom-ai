import { requireAuth } from "@/lib/auth-utils";
import { getCurriculumById } from "@/lib/queries/curriculum";
import { CurriculumHero } from "@/components/features/curriculum/curriculum-hero";
import { CurriculumPending } from "@/components/features/curriculum/curriculum-pending";
import { CurriculumTabs } from "@/components/features/curriculum/curriculum-tabs";

type Params = Promise<{ id: string }>;

export default async function CurriculumPage({ params }: { params: Params }) {
  await requireAuth();
  const { id } = await params;

  const curriculum = await getCurriculumById(id);

  // If the row isn't there yet, hand off to a client component that polls
  // (and the layout-level realtime listener will also `router.refresh()` this
  // server component on the curriculum-ready event). The pending component
  // surfaces a "not found" state once it gives up, so non-owners and bad ids
  // still see a clear failure after a timeout.
  if (!curriculum) {
    return <CurriculumPending id={id} />;
  }

  return (
    <div className="flex min-w-0 flex-col">
      <CurriculumHero
        title={curriculum.title}
        overview={curriculum.overview}
        level={curriculum.level}
        estimatedDuration={curriculum.estimatedDuration}
      />
      <CurriculumTabs
        objectives={curriculum.objectives}
        modules={curriculum.modules}
        resources={curriculum.recommendedResources}
      />
    </div>
  );
}
