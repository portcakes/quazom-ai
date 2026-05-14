import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@quazom-ai/db";
import type {
  ResourceKind,
  ResourceFileType,
  ResourceStatus,
} from "@quazom-ai/db/enums";

export type ResourceSummary = {
  id: string;
  userId: string;
  kind: ResourceKind;
  title: string;
  description: string | null;
  url: string | null;
  domain: string | null;
  fileKey: string | null;
  fileType: ResourceFileType | null;
  fileSize: number | null;
  fileMimeType: string | null;
  fileName: string | null;
  status: ResourceStatus;
  statusMessage: string | null;
  hasExtractedContent: boolean;
  createdAt: Date;
  updatedAt: Date;
  curriculumIds: string[];
  lessonIds: string[];
};

export type ResourceDetail = ResourceSummary & {
  /** Cached markdown / extracted text. PDF resources keep this null. */
  content: string | null;
  /** When the reader-mode markdown was last regenerated (LINK only). */
  extractedAt: Date | null;
  /** Hydrated curriculum/lesson links so the viewer can render quick chips. */
  curricula: { id: string; title: string }[];
  lessons: { id: string; title: string; curriculumId: string }[];
};

type ListOptions = {
  curriculumId?: string;
  lessonId?: string;
  kind?: ResourceKind;
  /** When set, only resources whose title/description match are returned. */
  search?: string;
};

export async function listUserResources(
  opts: ListOptions = {},
): Promise<ResourceSummary[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  type Where = NonNullable<
    NonNullable<Parameters<typeof prisma.resource.findMany>[0]>["where"]
  >;
  const where: Where = { userId: session.user.id };
  if (opts.kind) where.kind = opts.kind;
  if (opts.curriculumId) {
    where.curriculumLinks = { some: { curriculumId: opts.curriculumId } };
  } else if (opts.lessonId) {
    where.lessonLinks = { some: { lessonId: opts.lessonId } };
  }
  if (opts.search?.trim()) {
    const q = opts.search.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { domain: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      kind: true,
      title: true,
      description: true,
      url: true,
      domain: true,
      fileKey: true,
      fileType: true,
      fileSize: true,
      fileMimeType: true,
      fileName: true,
      status: true,
      statusMessage: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      curriculumLinks: { select: { curriculumId: true } },
      lessonLinks: { select: { lessonId: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    url: row.url,
    domain: row.domain,
    fileKey: row.fileKey,
    fileType: row.fileType,
    fileSize: row.fileSize,
    fileMimeType: row.fileMimeType,
    fileName: row.fileName,
    status: row.status,
    statusMessage: row.statusMessage,
    hasExtractedContent: !!row.content && row.content.trim().length > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    curriculumIds: row.curriculumLinks.map((l) => l.curriculumId),
    lessonIds: row.lessonLinks.map((l) => l.lessonId),
  }));
}

export async function getResourceForCurrentUser(
  id: string,
): Promise<ResourceDetail | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const row = await prisma.resource.findFirst({
    where: { id, userId: session.user.id },
    include: {
      curriculumLinks: {
        include: {
          curriculum: { select: { id: true, title: true } },
        },
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
  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    url: row.url,
    domain: row.domain,
    fileKey: row.fileKey,
    fileType: row.fileType,
    fileSize: row.fileSize,
    fileMimeType: row.fileMimeType,
    fileName: row.fileName,
    status: row.status,
    statusMessage: row.statusMessage,
    hasExtractedContent: !!row.content && row.content.trim().length > 0,
    content: row.content,
    extractedAt: row.extractedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    curriculumIds: row.curriculumLinks.map((l) => l.curriculumId),
    lessonIds: row.lessonLinks.map((l) => l.lessonId),
    curricula: row.curriculumLinks.map((l) => ({
      id: l.curriculum.id,
      title: l.curriculum.title,
    })),
    lessons: row.lessonLinks.map((l) => ({
      id: l.lesson.id,
      title: l.lesson.title,
      curriculumId: l.lesson.module.curriculumId,
    })),
  };
}

/**
 * Same shape as {@link ResourceSummary} but filtered to the resources the
 * user has explicitly attached to a curriculum (and/or its lessons). Used by
 * the curriculum detail page to render the "My resources" section alongside
 * the AI's `recommendedResources` list.
 */
export async function getResourcesForCurriculum(
  curriculumId: string,
): Promise<ResourceSummary[]> {
  return listUserResources({ curriculumId });
}
