import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { getCurriculumById } from "@/lib/queries/curriculum";
import { CurriculumHero } from "@/components/features/curriculum/curriculum-hero";

type Params = Promise<{ id: string }>;

export default async function CurriculumPage({ params }: { params: Params }) {
  await requireAuth();
  const { id } = await params;

  const curriculum = await getCurriculumById(id);
  if (!curriculum) {
    // Either it doesn't exist, or the signed-in user doesn't own it.
    // Surface the same 404 in both cases to avoid leaking existence.
    notFound();
  }

  return (
    <div className="flex flex-col">
      <CurriculumHero
        title={curriculum.title}
        overview={curriculum.overview}
        level={curriculum.level}
        estimatedDuration={curriculum.estimatedDuration}
      />
    </div>
  );
}
