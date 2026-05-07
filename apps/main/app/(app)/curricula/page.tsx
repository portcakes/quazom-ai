import Link from "next/link";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { getUserCurricula } from "@/lib/queries/courses";
import { CurriculumCollectionCard } from "@/components/features/curriculum/curriculum-collection-card";

export default async function CurriculaCollectionPage() {
  await requireAuth();
  const [user, curricula] = await Promise.all([
    getCurrentUser(),
    getUserCurricula(),
  ]);

  if (!user) {
    // requireAuth() above should have redirected, but bail out defensively.
    return null;
  }

  const visible = curricula.filter((c) => !c.isHidden);
  const hidden = curricula.filter((c) => c.isHidden);
  const total = curricula.length;
  const noun = total === 1 ? "Curriculum" : "Curricula";

  return (
    <div className="flex flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 md:py-14">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {total} {noun} Collected
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {user.fullName}&apos;s Curricula Collection
          </h1>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
        <section className="flex flex-col gap-5">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            All Curricula
          </h2>
          {visible.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((curriculum) => (
                <li key={curriculum.id} className="flex">
                  <CurriculumCollectionCard curriculum={curriculum} />
                </li>
              ))}
            </ul>
          ) : (
            <CollectionEmptyState />
          )}
        </section>

        {hidden.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                Hidden Curricula
              </h2>
              <p className="text-sm text-muted-foreground">
                These curricula are hidden from the sidebar but still part of
                your collection.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hidden.map((curriculum) => (
                <li key={curriculum.id} className="flex">
                  <CurriculumCollectionCard curriculum={curriculum} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function CollectionEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <p className="text-base font-medium text-foreground">
        No curricula yet
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Create your first curriculum from the sidebar to start building your
        collection.
      </p>
      <Link
        href="/"
        className="mt-2 text-sm font-medium text-foreground underline underline-offset-4 hover:text-foreground/80"
      >
        Go home
      </Link>
    </div>
  );
}
