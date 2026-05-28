import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@quazom-ai/db";
import { getSignedDownloadUrl, r2IsConfigured } from "@/lib/r2";
import { ResourceViewer } from "@/components/features/resources/resource-viewer";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { title: "Quazom - Resource" };
  const row = await prisma.resource.findFirst({
    where: { id, userId: session.user.id },
    select: { title: true },
  });
  return { title: `Quazom - ${row?.title ?? "Resource"}` };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Params;
}) {
  await requireAuth();
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const row = await prisma.resource.findFirst({
    where: { id, userId: session.user.id },
    include: {
      curriculumLinks: {
        include: { curriculum: { select: { id: true, title: true } } },
        orderBy: { createdAt: "asc" },
      },
      lessonLinks: {
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              module: { select: { curriculumId: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!row) notFound();

  let signedFileUrl: string | null = null;
  if (row.kind === "FILE" && row.fileKey && r2IsConfigured()) {
    try {
      signedFileUrl = await getSignedDownloadUrl({
        key: row.fileKey,
        filename: row.fileName ?? row.title,
        expiresInSeconds: 600,
      });
    } catch {
      signedFileUrl = null;
    }
  }

  return (
    <ResourceViewer
      initial={{
        id: row.id,
        kind: row.kind,
        title: row.title,
        description: row.description,
        url: row.url,
        domain: row.domain,
        fileType: row.fileType,
        fileSize: row.fileSize,
        fileName: row.fileName,
        fileMimeType: row.fileMimeType,
        status: row.status,
        statusMessage: row.statusMessage,
        content: row.content,
        extractedAt: row.extractedAt,
        signedFileUrl,
        curricula: row.curriculumLinks.map((l) => ({
          id: l.curriculum.id,
          title: l.curriculum.title,
        })),
        lessons: row.lessonLinks.map((l) => ({
          id: l.lesson.id,
          title: l.lesson.title,
          curriculumId: l.lesson.module.curriculumId,
        })),
      }}
    />
  );
}
