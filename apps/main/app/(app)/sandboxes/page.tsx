import Link from "next/link";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { getUserSandboxes } from "@/lib/queries/sandbox";
import { SandboxCollectionCard } from "@/components/features/sandbox/sandbox-collection-card";

export const metadata = {
  title: "Quazom - Sandbox Showcase",
  description: "Your collection of Knowledge Sandboxes",
};

export default async function SandboxShowcasePage() {
  await requireAuth();
  const [user, sandboxes] = await Promise.all([
    getCurrentUser(),
    getUserSandboxes(),
  ]);

  if (!user) {
    return null;
  }

  const visible = sandboxes.filter((s) => !s.isHidden);
  const hidden = sandboxes.filter((s) => s.isHidden);
  const total = sandboxes.length;
  const noun = total === 1 ? "Sandbox" : "Sandboxes";

  return (
    <div className="flex flex-col">
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 md:py-14">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {total} {noun} Collected
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {user.fullName}&apos;s Sandbox Showcase
          </h1>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
        <section className="flex flex-col gap-5">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            All Sandboxes
          </h2>
          {visible.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((sandbox) => (
                <li key={sandbox.id} className="flex">
                  <SandboxCollectionCard sandbox={sandbox} />
                </li>
              ))}
            </ul>
          ) : (
            <SandboxEmptyState />
          )}
        </section>

        {hidden.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                Hidden Sandboxes
              </h2>
              <p className="text-sm text-muted-foreground">
                These sandboxes are hidden from the sidebar but still part of
                your collection.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hidden.map((sandbox) => (
                <li key={sandbox.id} className="flex">
                  <SandboxCollectionCard sandbox={sandbox} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function SandboxEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <p className="text-base font-medium text-foreground">No sandboxes yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Open your first Knowledge Sandbox from the sidebar to start collecting
        sources and researching with AI.
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
