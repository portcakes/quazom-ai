import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { getCurrentUser } from "@/lib/queries/user";
import { getSandboxById } from "@/lib/queries/sandbox";
import { SandboxHero } from "@/components/features/sandbox/sandbox-hero";
import { SandboxTabs } from "@/components/features/sandbox/sandbox-tabs";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const sandbox = await getSandboxById(id);
  return {
    title: `Quazom - ${sandbox?.title ?? "Sandbox"}`,
    description: sandbox?.description || "Your Knowledge Sandbox",
  };
}

export default async function SandboxPage({ params }: { params: Params }) {
  await requireAuth();
  const { id } = await params;

  const [user, sandbox] = await Promise.all([
    getCurrentUser(),
    getSandboxById(id),
  ]);

  if (!user || !sandbox) {
    notFound();
  }

  return (
    <div className="flex min-w-0 flex-col">
      <SandboxHero
        title={sandbox.title}
        description={sandbox.description}
        thesis={sandbox.thesis}
        sourceCount={sandbox.sources.length}
        researchSessionCount={sandbox.researchSessions.length}
        materialCount={sandbox.materials.length}
      />
      <SandboxTabs sandbox={sandbox} userId={user.id} />
    </div>
  );
}
