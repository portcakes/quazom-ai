import Link from "next/link";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { getUserCurricula } from "@/lib/queries/courses";
import { getUserSandboxes } from "@/lib/queries/sandbox";
import { CurriculumCollectionCard } from "@/components/features/curriculum/curriculum-collection-card";
import { SandboxCollectionCard } from "@/components/features/sandbox/sandbox-collection-card";

export const metadata = {
  title: "Quazom - Study Sessions",
  description: "All of your curricula and sandboxes in one place",
};

export default async function StudiesPage() {
  await requireAuth();
  const [user, curricula, sandboxes] = await Promise.all([
    getCurrentUser(),
    getUserCurricula(),
    getUserSandboxes(),
  ]);

  if (!user) {
    return null;
  }

  const visibleCurricula = curricula.filter((c) => !c.isHidden);
  const visibleSandboxes = sandboxes.filter((s) => !s.isHidden);
  const total = visibleCurricula.length + visibleSandboxes.length;
  const noun = total === 1 ? "Study" : "Studies";
  const hasAny = curricula.length > 0 || sandboxes.length > 0;

  return (
    <div className="flex flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 md:py-14">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {total} {noun} In Progress
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {user.fullName}&apos;s Study Sessions
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Everything you&apos;re learning — guided Curricula and open-ended
            Knowledge Sandboxes — together in one place.
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
        {hasAny ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                All Studies
              </h2>
              <div className="flex gap-3 text-sm text-muted-foreground">
                <Link
                  href="/curricula"
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  Curricula
                </Link>
                <Link
                  href="/sandboxes"
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  Sandboxes
                </Link>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCurricula.map((curriculum) => (
                <li key={`c-${curriculum.id}`} className="flex">
                  <CurriculumCollectionCard curriculum={curriculum} />
                </li>
              ))}
              {visibleSandboxes.map((sandbox) => (
                <li key={`s-${sandbox.id}`} className="flex">
                  <SandboxCollectionCard sandbox={sandbox} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <StudiesEmptyState />
        )}
      </div>
    </div>
  );
}

function StudiesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <p className="text-base font-medium text-foreground">No studies yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Use “New Studies” in the sidebar to create your first Curriculum or
        Knowledge Sandbox.
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
