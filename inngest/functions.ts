import { inngest } from "./client";
import { userChannel } from "./channels";
import {
  assessmentLengthForLevel,
  buildContinuityPromptBody,
  curriculumSchema,
  dbToActivityType,
  exerciseQuestionsOnlySchema,
  formatActivityTypesForPrompt,
  lessonGenerationSchema,
  levelExtensionSchema,
  modulesBackfillSchema,
  nextCurriculumLevel,
  quizQuestionsOnlySchema,
  submissionFeedbackSchema,
  thesisGenerationSchema,
  activityTypeToDb,
  type ContinuityPromptSource,
  type LessonActivityType,
  type QuizQuestion,
} from "./schemas";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import prisma from "@quazom-ai/db";
import { recordAiUsage } from "./ai-usage";

const google = createGoogleGenerativeAI();
const MODEL = "gemini-2.5-flash-lite";

// Strip HTML tags + collapse whitespace. Used when feeding rich-text
// continuity notes (TipTap HTML) into the thesis prompt — the model
// reasons just as well on plaintext and we avoid wasting tokens on
// `<p style="..."` noise.
function htmlToPlaintext(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Load the pre-created Curriculum row + attached sources + extracted source
// content. The tRPC layer inserts the row in PENDING before firing the
// event, so by the time we run there's always a row to update. Shared by
// the single-source and continuity-source paths.
async function loadCurriculumWithSources(
  curriculumId: string,
  userId: string,
) {
  const row = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: {
      id: true,
      userId: true,
      subject: true,
      level: true,
      goal: true,
      kind: true,
      thesis: true,
      includedActivityTypes: true,
      sources: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          kind: true,
          order: true,
          topicText: true,
          resourceId: true,
          continuityNoteId: true,
          resource: {
            select: {
              id: true,
              kind: true,
              title: true,
              url: true,
              fileType: true,
              content: true,
            },
          },
        },
      },
    },
  });
  if (!row) throw new Error(`Curriculum ${curriculumId} not found`);
  if (row.userId !== userId) {
    throw new Error("Curriculum does not belong to the requesting user");
  }
  return row;
}

// Translate the persisted CurriculumSource rows into the prompt-ready
// shape used by `buildContinuityPromptBody`. Sources without extracted
// content (e.g. a resource where extraction was deferred and never ran)
// are skipped — the tRPC pre-flight is meant to catch this, but if a row
// slips through we'd rather generate a curriculum from what we have than
// crash the whole job.
function sourcesToPromptParts(
  sources: Awaited<ReturnType<typeof loadCurriculumWithSources>>["sources"],
): ContinuityPromptSource[] {
  const out: ContinuityPromptSource[] = [];
  for (const source of sources) {
    if (source.kind === "TOPIC" && source.topicText) {
      out.push({ kind: "topic", text: source.topicText });
      continue;
    }
    if (!source.resource) continue;
    const r = source.resource;
    if (source.kind === "LINK_RESOURCE" && r.url) {
      out.push({
        kind: "link",
        title: r.title,
        url: r.url,
        content: r.content ?? "",
      });
    } else if (source.kind === "FILE_RESOURCE") {
      out.push({
        kind: "file",
        title: r.title,
        fileType: r.fileType ?? "FILE",
        content: r.content ?? "",
      });
    }
  }
  return out;
}

// Common system prompt for every curriculum generator below.
const CURRICULUM_SYSTEM_PROMPT =
  "You are an expert instructional designer. Generate clear, well-structured personalized curricula. Be specific, actionable, and avoid filler.";

// Build the prompt for a single-source curriculum. `optionalSource` is a
// link or file resource the user attached as their one extra ingredient.
function buildSingleSourcePrompt(args: {
  subject: string;
  level: string;
  goal: string;
  allowedActivityTypes: LessonActivityType[];
  optionalSource: ContinuityPromptSource | null;
}): string {
  const sourceBlock = args.optionalSource
    ? `\n\nSource material the learner provided (treat as authoritative context — extract its key concepts into the curriculum where relevant):\n${buildContinuityPromptBody([args.optionalSource])}`
    : "";
  return `Create a personalized curriculum.

Subject: ${args.subject || "(none — derive from the source material)"}
Level: ${args.level}
Learner goal: ${args.goal || "(none — synthesise from the source material if provided)"}
Allowed lesson activity types: ${formatActivityTypesForPrompt(args.allowedActivityTypes)}${sourceBlock}

Sequence modules from foundational to advanced. Each lesson must have a concrete activityType from the allowed set above — do NOT emit any other activity type. Recommended resources should be high-quality and reputable.`;
}

// Build the prompt for a multi-source (Continuity) curriculum. Thesis is
// rendered first when present so it acts as the model's north star; the
// body of every source is then interleaved by `buildContinuityPromptBody`.
function buildContinuityPrompt(args: {
  subject: string;
  level: string;
  goal: string;
  thesis: string | null;
  sources: ContinuityPromptSource[];
  allowedActivityTypes: LessonActivityType[];
}): string {
  const thesisBlock = args.thesis
    ? `\nThesis / research direction (drive the curriculum toward this):\n"""\n${args.thesis}\n"""\n`
    : "";
  return `Create a personalized Continuity Curriculum from multiple sources.
${thesisBlock}
Subject (optional anchor): ${args.subject || "(none — derive from the sources + thesis)"}
Level: ${args.level}
Learner goal: ${args.goal || "(none — synthesise from the sources + thesis)"}
Allowed lesson activity types: ${formatActivityTypesForPrompt(args.allowedActivityTypes)}

Sources (treat as authoritative context — weave concepts from across them into a coherent curriculum that reflects their connections):

${buildContinuityPromptBody(args.sources)}

Sequence modules from foundational to advanced. Each lesson must have a concrete activityType from the allowed set above — do NOT emit any other activity type. Recommended resources should be high-quality and reputable. Where a lesson is grounded in a specific source, mention it by name in the lesson description.`;
}

// Db-side activity type union, matching the Prisma enum. Kept inline so
// this file doesn't have to reach into the generated client just for a
// string literal type.
type DbActivityType =
  | "VIDEO"
  | "QUIZ"
  | "EXERCISE"
  | "PROJECT"
  | "DISCUSSION"
  | "READING"
  | "OTHER";

// Persist a parsed curriculum body onto the pre-existing row (created by
// the tRPC layer in PENDING state) and pre-create Module + Lesson STUB
// rows. Wrapped in a transaction so a half-written curriculum can never
// leak into the UI; the row is flipped to READY in the same write.
//
// `allowedActivityTypesDb` is the DB-facing (UPPER_CASE) enum array; we
// filter against the lessons the AI emitted at this layer so even if the
// model drifts and ignores the prompt's type filter we never persist a
// lesson the user didn't ask for.
async function saveGeneratedCurriculum(
  curriculumId: string,
  parsed: {
    title: string;
    overview: string;
    estimatedDuration: string;
    objectives: unknown;
    modules: Array<{
      title: string;
      summary: string;
      objectives: string[];
      lessons: Array<{
        title: string;
        description: string;
        activityType: LessonActivityType;
      }>;
    }>;
    recommendedResources: unknown;
  },
  defaultLevel: string,
  allowedActivityTypesDb: readonly DbActivityType[],
) {
  return prisma.$transaction(async (tx) => {
    const allowedSet = new Set<DbActivityType>(allowedActivityTypesDb);
    const updated = await tx.curriculum.update({
      where: { id: curriculumId },
      data: {
        title: parsed.title,
        overview: parsed.overview,
        estimatedDuration: parsed.estimatedDuration,
        objectives: parsed.objectives as object,
        modules: parsed.modules as unknown as object,
        recommendedResources: parsed.recommendedResources as object,
        raw_ai_response: JSON.stringify(parsed),
        structured_data_json: parsed as unknown as object,
        status: "READY",
        statusMessage: null,
      },
      select: { id: true, title: true },
    });

    const initialLevel = defaultLevel.toLowerCase();
    for (const [moduleIdx, mod] of parsed.modules.entries()) {
      const moduleId = crypto.randomUUID();
      await tx.module.create({
        data: {
          id: moduleId,
          curriculumId,
          title: mod.title,
          summary: mod.summary,
          order: moduleIdx + 1,
          level: initialLevel,
          objectives: mod.objectives,
        },
      });

      const filtered =
        allowedActivityTypesDb.length === 0
          ? mod.lessons
          : mod.lessons.filter((l) =>
              // Defensive: even when the prompt forbids it the model can drift,
              // so we drop any lesson whose activityType isn't in the filter
              // before persisting. Empty allowed set means "no filter".
              allowedSet.has(activityTypeToDb(l.activityType)),
            );
      if (filtered.length === 0) continue;

      await tx.lesson.createMany({
        data: filtered.map((lesson, lessonIdx) => ({
          id: crypto.randomUUID(),
          moduleId,
          title: lesson.title,
          description: lesson.description,
          activityType: activityTypeToDb(lesson.activityType),
          order: lessonIdx + 1,
          status: "STUB",
        })),
      });
    }

    return updated;
  });
}

// --------------------------------------------------------------------------
// createCurriculum
//
// Generates a single-source curriculum from a pre-existing PENDING row.
// The tRPC layer mints the Curriculum + any CurriculumSource rows up
// front (so source ownership / extraction / quota are checked before any
// AI tokens are spent); this function loads them, runs the model, and
// flips the row to READY (or FAILED).
// --------------------------------------------------------------------------
export const createCurriculum = inngest.createFunction(
  { id: "process-curriculum", triggers: { event: "app/curriculum.created" } },
  async ({ event, step }) => {
    const { id, userId } = event.data;
    try {
      const curriculumRow = await step.run("load-curriculum", () =>
        loadCurriculumWithSources(id, userId),
      );

      const promptSources = sourcesToPromptParts(curriculumRow.sources);
      // Single-source curricula carry at most one prompt-ready source — extras
      // shouldn't happen (the tRPC layer routes 2+ to the continuity event)
      // but be defensive and grab the first one if it does.
      const optionalSource = promptSources[0] ?? null;

      const allowedActivityTypesDb = curriculumRow.includedActivityTypes;
      // The prompt builders render lower-case AI-facing names because that's
      // what the curriculum schema accepts. Convert here at the boundary.
      const allowedActivityTypesAi = allowedActivityTypesDb.map((t) =>
        dbToActivityType(t),
      );
      const result = await step.ai.wrap(
        "gemini-generate-curriculum",
        generateObject,
        {
          model: google(MODEL),
          schema: curriculumSchema,
          system: CURRICULUM_SYSTEM_PROMPT,
          prompt: buildSingleSourcePrompt({
            subject: curriculumRow.subject,
            level: curriculumRow.level,
            goal: curriculumRow.goal,
            allowedActivityTypes: allowedActivityTypesAi,
            optionalSource,
          }),
        },
      );

      await step.run("record-curriculum-usage", () =>
        recordAiUsage({
          userId,
          kind: "CURRICULUM",
          model: MODEL,
          result,
          resourceId: id,
        }),
      );

      const curriculum = curriculumSchema.parse(
        (result as { object: unknown }).object,
      );

      const saved = await step.run("save-curriculum-and-stubs", () =>
        saveGeneratedCurriculum(
          id,
          curriculum,
          curriculum.level ?? curriculumRow.level ?? "beginner",
          allowedActivityTypesDb,
        ),
      );

      await step.realtime.publish(
        "publish-curriculum-ready",
        userChannel(userId).curriculumReady,
        { id: saved.id, title: saved.title },
      );

      return { curriculumId: saved.id, title: saved.title };
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Generation failed";
      // Flip the row to FAILED so the detail page can render a retry CTA.
      // We swallow this update's error — the outer throw still surfaces in
      // the Inngest dashboard for ops triage.
      await step.run("mark-curriculum-failed", async () => {
        try {
          await prisma.curriculum.update({
            where: { id },
            data: { status: "FAILED", statusMessage: message },
          });
        } catch (innerErr) {
          console.error(
            "[createCurriculum] failed to mark curriculum FAILED",
            innerErr,
          );
        }
      });
      await step.realtime.publish(
        "publish-curriculum-failed",
        userChannel(userId).curriculumFailed,
        { id, message },
      );
      throw err;
    }
  },
);

// --------------------------------------------------------------------------
// createContinuityCurriculum
//
// Multi-source (Continuity) variant. Reads the pre-created Curriculum row
// with its CurriculumSource rows, builds a prompt that includes every
// source's extracted body (capped via `buildContinuityPromptBody`) plus
// the optional thesis, and persists the result the same way the single-
// source flow does. Tracked as a separate AiUsageKind so per-feature spend
// stays auditable.
// --------------------------------------------------------------------------
export const createContinuityCurriculum = inngest.createFunction(
  {
    id: "process-continuity-curriculum",
    triggers: { event: "app/curriculum.continuity_created" },
  },
  async ({ event, step }) => {
    const { id, userId } = event.data;
    try {
      const curriculumRow = await step.run("load-curriculum", () =>
        loadCurriculumWithSources(id, userId),
      );

      const promptSources = sourcesToPromptParts(curriculumRow.sources);
      if (promptSources.length === 0) {
        throw new Error(
          "Continuity curriculum has no usable sources to generate from",
        );
      }

      const allowedActivityTypesDb = curriculumRow.includedActivityTypes;
      const allowedActivityTypesAi = allowedActivityTypesDb.map((t) =>
        dbToActivityType(t),
      );
      const result = await step.ai.wrap(
        "gemini-generate-continuity-curriculum",
        generateObject,
        {
          model: google(MODEL),
          schema: curriculumSchema,
          system: CURRICULUM_SYSTEM_PROMPT,
          prompt: buildContinuityPrompt({
            subject: curriculumRow.subject,
            level: curriculumRow.level,
            goal: curriculumRow.goal,
            thesis: curriculumRow.thesis,
            sources: promptSources,
            allowedActivityTypes: allowedActivityTypesAi,
          }),
        },
      );

      await step.run("record-continuity-curriculum-usage", () =>
        recordAiUsage({
          userId,
          kind: "CURRICULUM_CONTINUITY",
          model: MODEL,
          result,
          resourceId: id,
        }),
      );

      const curriculum = curriculumSchema.parse(
        (result as { object: unknown }).object,
      );

      const saved = await step.run("save-continuity-curriculum-and-stubs", () =>
        saveGeneratedCurriculum(
          id,
          curriculum,
          curriculum.level ?? curriculumRow.level ?? "beginner",
          allowedActivityTypesDb,
        ),
      );

      await step.realtime.publish(
        "publish-curriculum-ready",
        userChannel(userId).curriculumReady,
        { id: saved.id, title: saved.title },
      );

      return { curriculumId: saved.id, title: saved.title };
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Generation failed";
      await step.run("mark-continuity-curriculum-failed", async () => {
        try {
          await prisma.curriculum.update({
            where: { id },
            data: { status: "FAILED", statusMessage: message },
          });
        } catch (innerErr) {
          console.error(
            "[createContinuityCurriculum] failed to mark curriculum FAILED",
            innerErr,
          );
        }
      });
      await step.realtime.publish(
        "publish-curriculum-failed",
        userChannel(userId).curriculumFailed,
        { id, message },
      );
      throw err;
    }
  },
);

// --------------------------------------------------------------------------
// generateThesisFromContinuityNotes
//
// Fired from the "Generate from continuity notes" button in the new
// curriculum modal. Loads N continuity notes, strips them to plaintext,
// runs the model with `thesisGenerationSchema`, then publishes the
// result to the modal via the `thesisReady` realtime topic. The modal
// listens with the `requestId` so two concurrent generations can't clobber
// each other.
// --------------------------------------------------------------------------
type GenerateThesisEvent = {
  data: {
    requestId: string;
    userId: string;
    noteIds: string[];
    subject?: string | null;
    goal?: string | null;
  };
};

export const generateThesisFromContinuityNotes = inngest.createFunction(
  {
    id: "generate-thesis-from-continuity-notes",
    triggers: { event: "app/thesis.generate" },
  },
  async ({
    event,
    step,
  }: {
    event: GenerateThesisEvent;
    step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"];
  }) => {
    const { requestId, userId, noteIds, subject, goal } = event.data;
    try {
      const notes = await step.run("load-continuity-notes", async () => {
        if (noteIds.length === 0) {
          throw new Error("No continuity notes selected");
        }
        const rows = await prisma.continuityNote.findMany({
          where: { id: { in: noteIds }, userId },
          select: { id: true, title: true, content: true },
        });
        if (rows.length === 0) {
          throw new Error("None of the selected notes are accessible");
        }
        return rows;
      });

      const noteBlocks = (
        notes as Array<{ id: string; title: string | null; content: string }>
      )
        .map((n, idx) => {
          const title = n.title?.trim() || `Untitled note ${idx + 1}`;
          const text = htmlToPlaintext(n.content).slice(0, 8000);
          return `### Note ${idx + 1}: ${title}\n${text}`;
        })
        .join("\n\n---\n\n");

      const result = await step.ai.wrap(
        "gemini-generate-thesis-from-notes",
        generateObject,
        {
          model: google(MODEL),
          schema: thesisGenerationSchema,
          system:
            "You synthesise a learner's research-style notes into a single, well-formed thesis statement that can anchor a multi-source curriculum. Output 1-3 sentences max — no preamble, no headings.",
          prompt: `The learner is about to generate a Continuity Curriculum from multiple sources. Read their continuity notes below and produce a single thesis statement that captures the central argument or research direction they appear to be building toward.

${subject ? `Anchoring subject (optional): ${subject}\n` : ""}${goal ? `Learner goal (optional): ${goal}\n` : ""}
Continuity notes:

${noteBlocks}

Return exactly one thesis statement in the structured response — concise, specific, and free of "the user is interested in" framing.`,
        },
      );

      await step.run("record-thesis-usage", () =>
        recordAiUsage({
          userId,
          kind: "CURRICULUM_THESIS",
          model: MODEL,
          result,
          resourceId: requestId,
        }),
      );

      const parsed = thesisGenerationSchema.parse(
        (result as { object: unknown }).object,
      );

      await step.realtime.publish(
        "publish-thesis-ready",
        userChannel(userId).thesisReady,
        { requestId, thesis: parsed.thesis.trim() },
      );

      return { requestId, thesis: parsed.thesis.trim() };
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Thesis generation failed";
      await step.realtime.publish(
        "publish-thesis-failed",
        userChannel(userId).thesisFailed,
        { requestId, message },
      );
      throw err;
    }
  },
);

// --------------------------------------------------------------------------
// backfillCurriculumModules
//
// Dev-only tool: regenerates a fresh 4-5 module / 5-8 lesson skeleton for an
// existing curriculum and creates the matching Module + Lesson STUB rows.
// Used to recover curricula that pre-date the change to pre-create stubs at
// curriculum-creation time. Refuses to run if the curriculum already has any
// modules to avoid clobbering real data.
// --------------------------------------------------------------------------
type BackfillModulesEvent = {
  data: {
    curriculumId: string;
    userId: string;
  };
};

export const backfillCurriculumModules = inngest.createFunction(
  {
    id: "backfill-curriculum-modules",
    triggers: { event: "app/curriculum.backfill_modules" },
  },
  async ({
    event,
    step,
  }: {
    event: BackfillModulesEvent;
    step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"];
  }) => {
    const { curriculumId, userId } = event.data;

    const curriculum = await step.run("load-curriculum", async () => {
      const row = await prisma.curriculum.findUnique({
        where: { id: curriculumId },
        select: {
          id: true,
          userId: true,
          title: true,
          subject: true,
          level: true,
          goal: true,
          overview: true,
          curriculumModules: { select: { id: true } },
        },
      });
      if (!row) throw new Error(`Curriculum ${curriculumId} not found`);
      if (row.userId !== userId) {
        throw new Error("Curriculum does not belong to the requesting user");
      }
      if (row.curriculumModules.length > 0) {
        throw new Error(
          "Curriculum already has modules; refusing to overwrite",
        );
      }
      return row;
    });

    const result = await step.ai.wrap(
      "gemini-backfill-modules",
      generateObject,
      {
        model: google(MODEL),
        schema: modulesBackfillSchema,
        system:
          "You are an expert instructional designer. Generate a clear, well-structured set of modules and lessons for an existing curriculum. Be specific, actionable, and avoid filler.",
        prompt: `Generate the module structure for the following existing curriculum.

Title: ${curriculum.title}
Subject: ${curriculum.subject}
Level: ${curriculum.level}
Learner goal: ${curriculum.goal}
Curriculum overview: ${curriculum.overview}

Constraints:
- Output exactly 4 to 5 modules.
- Each module must contain 5 to 8 lessons.
- Sequence modules from foundational to advanced.
- Each lesson must have a concrete activityType (one of: reading, video, quiz, exercise, project, discussion).
- Vary activityType across lessons within a module so the learner is not just reading.`,
      },
    );

    await step.run("record-backfill-usage", () =>
      recordAiUsage({
        userId,
        kind: "CURRICULUM_BACKFILL",
        model: MODEL,
        result,
        resourceId: curriculumId,
      }),
    );

    const parsed = modulesBackfillSchema.parse(
      (result as { object: unknown }).object,
    );

    const saved = await step.run("save-modules-and-lessons", async () => {
      return prisma.$transaction(async (tx) => {
        // Re-check inside the transaction in case the user clicked twice.
        const existing = await tx.module.count({ where: { curriculumId } });
        if (existing > 0) {
          throw new Error(
            "Curriculum already has modules (race); refusing to overwrite",
          );
        }

        let lessonCount = 0;
        const moduleLevel = (curriculum.level ?? "beginner").toLowerCase();
        for (const [moduleIdx, mod] of parsed.modules.entries()) {
          const moduleId = crypto.randomUUID();
          await tx.module.create({
            data: {
              id: moduleId,
              curriculumId,
              title: mod.title,
              summary: mod.summary,
              order: moduleIdx + 1,
              level: moduleLevel,
              objectives: mod.objectives,
            },
          });

          if (mod.lessons.length === 0) continue;

          await tx.lesson.createMany({
            data: mod.lessons.map((lesson, lessonIdx) => ({
              id: crypto.randomUUID(),
              moduleId,
              title: lesson.title,
              description: lesson.description,
              activityType: activityTypeToDb(lesson.activityType),
              order: lessonIdx + 1,
              status: "STUB",
            })),
          });
          lessonCount += mod.lessons.length;
        }

        // Keep the curriculum.modules JSON in sync for any future caller that
        // still reads from it. Not strictly required since the UI reads from
        // the relational rows, but cheap to do here.
        await tx.curriculum.update({
          where: { id: curriculumId },
          data: { modules: parsed.modules },
        });

        return { moduleCount: parsed.modules.length, lessonCount };
      });
    });

    // Reuse the curriculumReady topic so the existing layout-level listener
    // refreshes the curriculum page automatically.
    await step.realtime.publish(
      "publish-curriculum-ready",
      userChannel(userId).curriculumReady,
      { id: curriculum.id, title: curriculum.title },
    );

    return {
      curriculumId,
      moduleCount: saved.moduleCount,
      lessonCount: saved.lessonCount,
    };
  },
);

// --------------------------------------------------------------------------
// generateLesson
//
// Triggered when the user clicks "Generate Lesson". Loads the STUB row, asks
// the model for the base lesson body and the type-specific child content in a
// single object call, then persists both atomically and flips status to READY.
// --------------------------------------------------------------------------
type GenerateLessonEvent = {
  data: {
    lessonId: string;
    userId: string;
  };
};

export const generateLesson = inngest.createFunction(
  { id: "generate-lesson", triggers: { event: "app/lesson.generate" } },
  async ({ event, step }: { event: GenerateLessonEvent; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"] }) => {
    const { lessonId, userId } = event.data;

    // Load context: lesson + module + curriculum so we can craft a focused prompt.
    const context = await step.run("load-lesson-context", async () => {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          module: {
            include: {
              curriculum: {
                select: {
                  id: true,
                  userId: true,
                  subject: true,
                  level: true,
                  goal: true,
                  title: true,
                  // Set on the hidden curriculum that backs a Knowledge
                  // Sandbox. When present, this lesson is a sandbox Material
                  // and the prompt is rebuilt to inject + cite sources.
                  sandboxId: true,
                },
              },
            },
          },
        },
      });
      if (!lesson) throw new Error(`Lesson ${lessonId} not found`);
      if (lesson.module.curriculum.userId !== userId) {
        throw new Error("Lesson does not belong to the requesting user");
      }
      return lesson;
    });

    // Mark as GENERATING so the page knows to render the pending state.
    await step.run("mark-generating", async () => {
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { status: "GENERATING" },
      });
    });

    const activity = dbActivityToPrompt(context.activityType);

    // Sandbox Materials are backed by a hidden curriculum. When this lesson
    // belongs to one, load the cited sources and build a source-grounded
    // prompt that requires inline citations + a references list.
    const sandboxSources = context.module.curriculum.sandboxId
      ? await step.run("load-sandbox-material-sources", () =>
          loadSandboxMaterialSources(lessonId),
        )
      : null;

    const prompt =
      sandboxSources && sandboxSources.length > 0
        ? buildSandboxMaterialPrompt({
            sandboxTitle: context.module.curriculum.title,
            lessonTitle: context.title,
            activity,
            sources: sandboxSources,
          })
        : buildLessonPrompt({
            curriculumTitle: context.module.curriculum.title,
            curriculumSubject: context.module.curriculum.subject,
            curriculumLevel: context.module.curriculum.level,
            curriculumGoal: context.module.curriculum.goal,
            moduleTitle: context.module.title,
            moduleSummary: context.module.summary,
            lessonTitle: context.title,
            lessonDescription: context.description,
            activity,
          });

    let generated: ReturnType<typeof lessonGenerationSchema.parse>;
    try {
      const result = await step.ai.wrap("gemini-generate-lesson", generateObject, {
        model: google(MODEL),
        schema: lessonGenerationSchema,
        system:
          "You are an expert instructional designer. Generate one complete lesson. Populate the `base` field always, plus exactly the one child field that matches the requested activity type. Do not populate child fields that were not requested. Be concrete, accurate, and avoid filler.",
        prompt,
      });
      await step.run("record-lesson-usage", () =>
        recordAiUsage({
          userId,
          kind: "LESSON",
          model: MODEL,
          result,
          resourceId: lessonId,
        }),
      );
      generated = lessonGenerationSchema.parse(
        (result as { object: unknown }).object,
      );
    } catch (err) {
      await step.run("mark-failed", async () => {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { status: "FAILED" },
        });
      });
      await step.realtime.publish(
        "publish-lesson-failed",
        userChannel(userId).lessonFailed,
        { id: lessonId, message: (err as Error).message ?? "Generation failed" },
      );
      throw err;
    }

    const saved = await step.run("save-lesson-content", async () => {
      return prisma.$transaction(async (tx) => {
        // Update the base Lesson row.
        const updated = await tx.lesson.update({
          where: { id: lessonId },
          data: {
            title: generated.base.title,
            description: generated.base.description,
            summary: generated.base.summary,
            duration: generated.base.duration,
            objectives: generated.base.objectives,
            recommendedResources: generated.base.recommendedResources,
            content: "",
            status: "READY",
          },
          select: { id: true, title: true, activityType: true },
        });

        // Wipe any prior child rows (regenerations replace them entirely).
        await Promise.all([
          tx.video.deleteMany({ where: { lessonId } }),
          tx.quiz.deleteMany({ where: { lessonId } }),
          tx.exercise.deleteMany({ where: { lessonId } }),
          tx.project.deleteMany({ where: { lessonId } }),
          tx.discussion.deleteMany({ where: { lessonId } }),
          tx.readings.deleteMany({ where: { lessonId } }),
        ]);

        switch (updated.activityType) {
          case "VIDEO":
            if (generated.video) {
              await tx.video.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.video.title,
                  description: generated.video.description,
                  overview: generated.video.overview,
                  embedUrl: generated.video.embedUrl ?? "",
                  externalUrl: generated.video.externalUrl || generated.video.embedUrl || null,
                  thumbnailUrl: generated.video.thumbnailUrl || null,
                  duration: generated.video.duration ?? "",
                },
              });
            }
            break;
          case "QUIZ":
            if (generated.quiz) {
              await tx.quiz.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.quiz.title,
                  overview: generated.quiz.overview,
                  content: generated.quiz.content,
                  recommendedResources: generated.quiz.recommendedResources,
                  // Questions stay empty until the learner clicks "Generate
                  // quiz" and we fire the phase-2 inngest function.
                  questions: [],
                  questionsGenerated: false,
                },
              });
            }
            break;
          case "EXERCISE":
            if (generated.exercise) {
              await tx.exercise.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.exercise.title,
                  description: generated.exercise.description,
                  overview: generated.exercise.overview,
                  content: generated.exercise.content,
                  recommendedResources: generated.exercise.recommendedResources,
                  questions: [],
                  questionsGenerated: false,
                  // Hints are still part of phase 2 — they're question
                  // specific. Default to an empty array until then.
                  hints: [],
                },
              });
            }
            break;
          case "PROJECT":
            if (generated.project) {
              await tx.project.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.project.title,
                  summary: generated.project.summary,
                  objectives: generated.project.objectives,
                  recommendedResources: generated.project.recommendedResources,
                  projectType: projectTypeToDb(generated.project.projectType),
                },
              });
            }
            break;
          case "DISCUSSION":
            if (generated.discussion) {
              await tx.discussion.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.discussion.title,
                  summary: generated.discussion.summary,
                  objectives: generated.discussion.objectives,
                  recommendedResources: generated.discussion.recommendedResources,
                  chatHistory: [
                    {
                      role: "assistant",
                      content: generated.discussion.openingMessage,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                },
              });
            }
            break;
          case "READING":
          default:
            if (generated.reading) {
              await tx.readings.create({
                data: {
                  id: crypto.randomUUID(),
                  lessonId,
                  title: generated.reading.title,
                  summary: generated.reading.summary,
                  overview: generated.reading.overview,
                  content: generated.reading.content,
                  recommendedResources: generated.reading.recommendedResources,
                },
              });
            }
            break;
        }

        return updated;
      });
    });

    await step.realtime.publish(
      "publish-lesson-ready",
      userChannel(userId).lessonReady,
      { id: saved.id, title: saved.title },
    );

    return { lessonId: saved.id, title: saved.title };
  },
);

// --------------------------------------------------------------------------
// generateAssessmentQuestions
//
// Phase-2 generation for QUIZ and EXERCISE lessons. The lesson generation
// (phase 1) produces a topic reading + recommended resources only; the learner
// then clicks "Generate quiz/exercise" and we hit the AI a second time to
// produce the actual question set, sized to the module's level.
// --------------------------------------------------------------------------
type GenerateAssessmentEvent = {
  data: {
    kind: "quiz" | "exercise";
    id: string;
    lessonId: string;
    userId: string;
  };
};

export const generateAssessmentQuestions = inngest.createFunction(
  {
    id: "generate-assessment-questions",
    triggers: { event: "app/assessment.generate" },
  },
  async ({
    event,
    step,
  }: {
    event: GenerateAssessmentEvent;
    step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"];
  }) => {
    const { kind, id, lessonId, userId } = event.data;

    // Load enough context to (a) verify ownership and (b) size the question
    // pool to the module's level. We re-read the lesson's pre-assessment
    // reading so the AI doesn't drift from what the learner just studied.
    const context = await step.run("load-assessment-context", async () => {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          module: {
            include: {
              curriculum: {
                select: {
                  id: true,
                  userId: true,
                  subject: true,
                  level: true,
                  goal: true,
                  title: true,
                },
              },
            },
          },
        },
      });
      if (!lesson) throw new Error(`Lesson ${lessonId} not found`);
      if (lesson.module.curriculum.userId !== userId) {
        throw new Error("Lesson does not belong to the requesting user");
      }

      let topic = "";
      let overview = "";
      let title = lesson.title;
      if (kind === "quiz") {
        const row = await prisma.quiz.findUnique({ where: { id } });
        if (!row) throw new Error(`Quiz ${id} not found`);
        topic = row.content ?? "";
        overview = row.overview ?? "";
        title = row.title;
      } else {
        const row = await prisma.exercise.findUnique({ where: { id } });
        if (!row) throw new Error(`Exercise ${id} not found`);
        topic = row.content ?? "";
        overview = row.overview ?? "";
        title = row.title;
      }

      return { lesson, topic, overview, title };
    });

    const { min: minQ, max: maxQ } = assessmentLengthForLevel(
      context.lesson.module.level,
    );

    const sharedSystem =
      "You are an expert assessment designer. Generate concise, accurate multiple choice questions grounded in the supplied reading. Every question must test a real concept from the reading, not trivia. Exactly one answer per question is correct.";

    const sharedPrompt = `Generate ${kind === "quiz" ? "a quiz" : "an exercise"} for the following lesson.

Curriculum: ${context.lesson.module.curriculum.title} (${context.lesson.module.curriculum.subject})
Module level: ${context.lesson.module.level}
Lesson title: ${context.lesson.title}
Assessment title: ${context.title}

Overview the learner just read:
${context.overview}

Deep-dive the learner just read:
${context.topic}

Constraints:
- Produce between ${minQ} and ${maxQ} multiple choice questions, inclusive.
- Every question must have 4-6 plausible answers and exactly one correct answer.
- \`correctAnswerIndex\` must be a valid 0-based index into \`answers\`.
- Include a short explanation per question (1-2 sentences).
- Questions must be answerable using the supplied reading.${
      kind === "exercise"
        ? "\n- Also produce 2-4 short, helpful hints the learner can reveal."
        : ""
    }`;

    try {
      if (kind === "quiz") {
        const result = await step.ai.wrap(
          "gemini-generate-quiz-questions",
          generateObject,
          {
            model: google(MODEL),
            schema: quizQuestionsOnlySchema,
            system: sharedSystem,
            prompt: sharedPrompt,
          },
        );
        await step.run("record-quiz-questions-usage", () =>
          recordAiUsage({
            userId,
            kind: "LESSON",
            model: MODEL,
            result,
            resourceId: id,
          }),
        );
        const parsed = quizQuestionsOnlySchema.parse(
          (result as { object: unknown }).object,
        );
        await step.run("save-quiz-questions", async () => {
          await prisma.quiz.update({
            where: { id },
            data: {
              questions: normalizeQuestions(parsed.questions),
              questionsGenerated: true,
              // Reset any prior submission state so re-generating gives the
              // learner a clean slate.
              userAnswers: null as unknown as object,
              feedback: null as unknown as object,
              score: 0,
              isPassed: false,
              isCompleted: false,
            },
          });
        });
      } else {
        const result = await step.ai.wrap(
          "gemini-generate-exercise-questions",
          generateObject,
          {
            model: google(MODEL),
            schema: exerciseQuestionsOnlySchema,
            system: sharedSystem,
            prompt: sharedPrompt,
          },
        );
        await step.run("record-exercise-questions-usage", () =>
          recordAiUsage({
            userId,
            kind: "LESSON",
            model: MODEL,
            result,
            resourceId: id,
          }),
        );
        const parsed = exerciseQuestionsOnlySchema.parse(
          (result as { object: unknown }).object,
        );
        await step.run("save-exercise-questions", async () => {
          await prisma.exercise.update({
            where: { id },
            data: {
              questions: normalizeQuestions(parsed.questions),
              hints: parsed.hints ?? [],
              questionsGenerated: true,
              userAnswers: null as unknown as object,
              feedback: null as unknown as object,
              score: 0,
              isPassed: false,
              isCompleted: false,
            },
          });
        });
      }
    } catch (err) {
      // Surface the failure to the UI so the learner can retry.
      await step.realtime.publish(
        "publish-assessment-failed",
        userChannel(userId).assessmentFailed,
        { kind, id, lessonId, message: (err as Error).message ?? "Generation failed" },
      );
      throw err;
    }

    await step.realtime.publish(
      "publish-assessment-ready",
      userChannel(userId).assessmentReady,
      { kind, id, lessonId },
    );

    return { kind, id };
  },
);

// --------------------------------------------------------------------------
// extendCurriculumLevel
//
// Generates a fresh batch of modules + lesson stubs at the next difficulty
// tier (beginner → intermediate → advanced). Only callable when the learner
// has completed every lesson at the current top level and the curriculum
// isn't already at the cap.
// --------------------------------------------------------------------------
type ExtendCurriculumLevelEvent = {
  data: {
    curriculumId: string;
    userId: string;
    targetLevel: "intermediate" | "advanced";
  };
};

export const extendCurriculumLevel = inngest.createFunction(
  {
    id: "extend-curriculum-level",
    triggers: { event: "app/curriculum.extend_level" },
  },
  async ({
    event,
    step,
  }: {
    event: ExtendCurriculumLevelEvent;
    step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"];
  }) => {
    const { curriculumId, userId, targetLevel } = event.data;

    const curriculum = await step.run("load-curriculum", async () => {
      const row = await prisma.curriculum.findUnique({
        where: { id: curriculumId },
        select: {
          id: true,
          userId: true,
          title: true,
          subject: true,
          level: true,
          goal: true,
          overview: true,
          // The lesson-type filter the user picked at creation time also
          // applies when we extend the curriculum into the next tier — a
          // learner who deselected "discussion" lessons at creation
          // doesn't want them showing up only at the advanced level.
          includedActivityTypes: true,
          curriculumModules: {
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              summary: true,
              level: true,
              order: true,
            },
          },
        },
      });
      if (!row) throw new Error(`Curriculum ${curriculumId} not found`);
      if (row.userId !== userId) {
        throw new Error("Curriculum does not belong to the requesting user");
      }
      return row;
    });

    // Re-validate the level transition. The tRPC layer already does this but
    // doing it here too keeps the function safe to fire from anywhere.
    let currentTopLevel = "";
    for (const m of curriculum.curriculumModules) {
      const lvl = m.level.toLowerCase();
      if (lvl === "advanced") currentTopLevel = "advanced";
      else if (lvl === "intermediate" && currentTopLevel !== "advanced")
        currentTopLevel = "intermediate";
      else if (!currentTopLevel) currentTopLevel = lvl;
    }
    const expected = nextCurriculumLevel(currentTopLevel || curriculum.level);
    if (expected !== targetLevel) {
      throw new Error(
        `Cannot extend curriculum from ${currentTopLevel || curriculum.level} to ${targetLevel}`,
      );
    }

    const priorSummary = curriculum.curriculumModules
      .map((m: { title: string; summary: string }) => `- ${m.title}: ${m.summary}`)
      .join("\n");

    const allowedActivityTypesDb =
      curriculum.includedActivityTypes as DbActivityType[];
    const allowedActivityTypesAi = allowedActivityTypesDb.map((t) =>
      dbToActivityType(t),
    );
    const result = await step.ai.wrap(
      "gemini-extend-curriculum-level",
      generateObject,
      {
        model: google(MODEL),
        schema: levelExtensionSchema,
        system:
          "You are an expert instructional designer extending an existing curriculum into a harder difficulty tier. Build on what the learner already studied — do not repeat it. The new modules should explicitly assume mastery of the prior level.",
        prompt: `Extend the following curriculum into the ${targetLevel} tier.

Title: ${curriculum.title}
Subject: ${curriculum.subject}
Original learner goal: ${curriculum.goal}
Curriculum overview: ${curriculum.overview}
Allowed lesson activity types: ${formatActivityTypesForPrompt(allowedActivityTypesAi)}

Modules the learner has already completed (lower-tier material — do not repeat these directly):
${priorSummary}

Constraints:
- Output between 3 and 5 new modules at the ${targetLevel} level.
- Each module must contain 5-8 concrete lessons with a defined activityType from the allowed set above — do NOT emit any other activity type.
- Vary activityType across lessons within a module (within the allowed set) so the learner is not just reading.
- The modules should escalate in challenge through this batch and build on the prior level.`,
      },
    );

    await step.run("record-extend-usage", () =>
      recordAiUsage({
        userId,
        kind: "CURRICULUM_BACKFILL",
        model: MODEL,
        result,
        resourceId: curriculumId,
      }),
    );

    const parsed = levelExtensionSchema.parse(
      (result as { object: unknown }).object,
    );

    const allowedSet = new Set<DbActivityType>(allowedActivityTypesDb);
    const saved = await step.run("save-extended-modules", async () => {
      return prisma.$transaction(async (tx) => {
        // Re-fetch the highest existing order so the new modules sort after
        // every prior batch.
        const last = await tx.module.findFirst({
          where: { curriculumId },
          orderBy: [{ order: "desc" }],
          select: { order: true },
        });
        const startOrder = (last?.order ?? 0) + 1;

        let lessonCount = 0;
        for (const [moduleIdx, mod] of parsed.modules.entries()) {
          const moduleId = crypto.randomUUID();
          await tx.module.create({
            data: {
              id: moduleId,
              curriculumId,
              title: mod.title,
              summary: mod.summary,
              order: startOrder + moduleIdx,
              level: targetLevel,
              objectives: mod.objectives,
            },
          });

          // Defensive belt-and-suspenders: even when the prompt forbids it
          // the model can drift, so we drop any lesson whose activityType
          // isn't in the user's allowed set before persisting. Empty
          // allowed set means "no filter".
          const filtered =
            allowedActivityTypesDb.length === 0
              ? mod.lessons
              : mod.lessons.filter((l) =>
                  allowedSet.has(activityTypeToDb(l.activityType)),
                );
          if (filtered.length === 0) continue;

          await tx.lesson.createMany({
            data: filtered.map((lesson, lessonIdx) => ({
              id: crypto.randomUUID(),
              moduleId,
              title: lesson.title,
              description: lesson.description,
              activityType: activityTypeToDb(lesson.activityType),
              order: lessonIdx + 1,
              status: "STUB",
            })),
          });
          lessonCount += filtered.length;
        }

        return { moduleCount: parsed.modules.length, lessonCount };
      });
    });

    // Reuse the curriculumReady topic so the existing layout-level listener
    // refreshes the curriculum page automatically.
    await step.realtime.publish(
      "publish-curriculum-ready",
      userChannel(userId).curriculumReady,
      { id: curriculum.id, title: curriculum.title },
    );

    return {
      curriculumId,
      targetLevel,
      moduleCount: saved.moduleCount,
      lessonCount: saved.lessonCount,
    };
  },
);

// --------------------------------------------------------------------------
// gradeSubmission
//
// Generates AI feedback for a quiz/exercise after the learner submits answers.
// Correctness scoring is computed in the tRPC mutation (deterministic); this
// function just adds the qualitative feedback (strengths / weak areas / etc).
// --------------------------------------------------------------------------
type GradeSubmissionEvent = {
  data: {
    kind: "quiz" | "exercise";
    id: string;
    lessonId: string;
    userId: string;
  };
};

export const gradeSubmission = inngest.createFunction(
  { id: "grade-submission", triggers: { event: "app/submission.grade" } },
  async ({ event, step }: { event: GradeSubmissionEvent; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"] }) => {
    const { kind, id, lessonId, userId } = event.data;

    const submission = await step.run("load-submission", async () => {
      if (kind === "quiz") {
        const row = await prisma.quiz.findUnique({ where: { id } });
        if (!row) throw new Error(`Quiz ${id} not found`);
        return row;
      }
      const row = await prisma.exercise.findUnique({ where: { id } });
      if (!row) throw new Error(`Exercise ${id} not found`);
      return row;
    });

    const questions = (submission.questions ?? []) as QuizQuestion[];
    const userAnswers = (submission.userAnswers ?? []) as number[];

    const summaryLines = questions.map((q, idx) => {
      const userIdx = userAnswers[idx];
      const correct = userIdx === q.correctAnswerIndex;
      const userAnswer =
        typeof userIdx === "number" && q.answers[userIdx] !== undefined
          ? q.answers[userIdx]
          : "(no answer)";
      return `Q${idx + 1}: ${q.question}
  Correct answer: ${q.answers[q.correctAnswerIndex]}
  Learner answer: ${userAnswer} ${correct ? "✓" : "✗"}`;
    });

    const result = await step.ai.wrap("gemini-grade-submission", generateObject, {
      model: google(MODEL),
      schema: submissionFeedbackSchema,
      system:
        "You are a supportive but precise tutor. Given a learner's multiple-choice submission, identify their strengths and weak areas and suggest concrete next steps. Reference the specific topics from the questions. Keep each list to 2-5 items.",
      prompt: `Submission type: ${kind}
Score: ${submission.score} / ${submission.maxScore}
${submission.isPassed ? "Status: PASSED" : "Status: not yet passed"}

Per-question results:
${summaryLines.join("\n")}`,
    });

    await step.run("record-grade-usage", () =>
      recordAiUsage({
        userId,
        kind: "SUBMISSION_FEEDBACK",
        model: MODEL,
        result,
        resourceId: id,
      }),
    );

    const feedback = submissionFeedbackSchema.parse(
      (result as { object: unknown }).object,
    );

    await step.run("save-feedback", async () => {
      if (kind === "quiz") {
        await prisma.quiz.update({ where: { id }, data: { feedback } });
      } else {
        await prisma.exercise.update({ where: { id }, data: { feedback } });
      }
    });

    await step.realtime.publish(
      "publish-feedback-ready",
      userChannel(userId).feedbackReady,
      { kind, id, lessonId },
    );

    return { kind, id };
  },
);

// --------------------------------------------------------------------------
// replyToDiscussion
//
// Generates the next assistant turn for a discussion lesson.
// --------------------------------------------------------------------------
type DiscussionMessage = { role: "assistant" | "user"; content: string; createdAt: string };

type ReplyDiscussionEvent = {
  data: {
    discussionId: string;
    lessonId: string;
    userId: string;
  };
};

export const replyToDiscussion = inngest.createFunction(
  { id: "reply-to-discussion", triggers: { event: "app/discussion.reply" } },
  async ({ event, step }: { event: ReplyDiscussionEvent; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"] }) => {
    const { discussionId, lessonId, userId } = event.data;

    const discussion = await step.run("load-discussion", async () => {
      const d = await prisma.discussion.findUnique({
        where: { id: discussionId },
        include: {
          lesson: {
            include: { module: { include: { curriculum: true } } },
          },
        },
      });
      if (!d) throw new Error(`Discussion ${discussionId} not found`);
      if (d.lesson.module.curriculum.userId !== userId) {
        throw new Error("Discussion does not belong to the requesting user");
      }
      return d;
    });

    const history = (discussion.chatHistory ?? []) as DiscussionMessage[];
    const objectivesText = JSON.stringify(discussion.objectives);

    // Each discussion is intentionally short: opening prompt → user → AI →
    // user → AI (final). Pick the right system prompt + completion flag based
    // on which user turn we're replying to.
    const userTurnsSoFar = history.filter((m) => m.role === "user").length;
    const isFinalReply = userTurnsSoFar >= 2;

    const turnInstruction = isFinalReply
      ? `This is your closing turn. The learner has given a follow-up to your prior response. Build on what they said: validate where they're right, push back gently where they're not, and tie everything back to the discussion's objectives. End with a brief takeaway — no new questions, the discussion is wrapping up.`
      : `This is your first reply. Read the learner's stance and pick a side: clearly agree or disagree with their take, then defend that position with a concrete example or piece of evidence. Close with one focused follow-up question that pushes the learner to refine or defend their view.`;

    const reply = await step.ai.wrap("gemini-discussion-reply", generateText, {
      model: google(MODEL),
      system: `You are an inquisitive, supportive tutor leading a focused two-turn discussion on "${discussion.title}". Keep replies under 200 words and reference the discussion's objectives where relevant.

Discussion summary: ${discussion.summary}
Objectives: ${objectivesText}

${turnInstruction}`,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });

    await step.run("record-discussion-reply-usage", () =>
      recordAiUsage({
        userId,
        kind: "DISCUSSION_REPLY",
        model: MODEL,
        result: reply,
        resourceId: discussionId,
      }),
    );

    const reply_text = (reply as { text: string }).text;

    await step.run("append-reply", async () => {
      const next: DiscussionMessage[] = [
        ...history,
        { role: "assistant", content: reply_text, createdAt: new Date().toISOString() },
      ];
      await prisma.discussion.update({
        where: { id: discussionId },
        data: {
          chatHistory: next,
          // Final AI turn closes the conversation. The UI uses
          // `isCompleted` to lock the input; the tRPC layer also blocks
          // sends past this point so a stale tab can't bypass the cap.
          ...(isFinalReply ? { isCompleted: true } : {}),
        },
      });
    });

    await step.realtime.publish(
      "publish-discussion-ready",
      userChannel(userId).discussionMessageReady,
      { discussionId, lessonId },
    );

    return { discussionId, isCompleted: isFinalReply };
  },
);

// --------------------------------------------------------------------------
// replyToResearchSession
//
// Produces the AI reply for a Knowledge Sandbox research session. Unlike
// lesson discussions, research sessions have no turn cap — they're a free
// multi-turn Q&A grounded in the session's selected sources. Tracked as
// AiUsageKind.RESEARCH_REPLY for cost visibility only.
// --------------------------------------------------------------------------
type ReplyResearchEvent = {
  data: {
    sessionId: string;
    sandboxId: string;
    userId: string;
  };
};

export const replyToResearchSession = inngest.createFunction(
  { id: "reply-to-research-session", triggers: { event: "app/research.reply" } },
  async ({ event, step }: { event: ReplyResearchEvent; step: Parameters<Parameters<typeof inngest.createFunction>[1]>[0]["step"] }) => {
    const { sessionId, sandboxId, userId } = event.data;

    try {
      const session = await step.run("load-research-session", async () => {
        const s = await prisma.researchSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            title: true,
            sourceIds: true,
            chatHistory: true,
            sandbox: { select: { id: true, userId: true, title: true } },
          },
        });
        if (!s) throw new Error(`Research session ${sessionId} not found`);
        if (s.sandbox.userId !== userId) {
          throw new Error("Research session does not belong to the requesting user");
        }
        return s;
      });

      const selectedSourceIds = Array.isArray(session.sourceIds)
        ? (session.sourceIds as string[])
        : [];

      // Reuse the sandbox source loader shape: resolve the selected sources
      // (or every source) to { label, kind, content }.
      const sources = await step.run("load-research-sources", () =>
        loadSandboxSourcesByIds(sandboxId, selectedSourceIds),
      );

      const history = Array.isArray(session.chatHistory)
        ? (session.chatHistory as DiscussionMessage[])
        : [];

      const sourcesBlock =
        sources.length > 0
          ? sources
              .map(
                (s: SandboxPromptSource, i: number) =>
                  `[Source ${i + 1}: ${s.label}] (${s.kind})\n${s.content || "(no extracted text — reason from the title/label)"}`,
              )
              .join("\n\n---\n\n")
          : "(No specific sources were attached to this session — answer from general knowledge but stay grounded and note when you're speculating.)";

      const reply = await step.ai.wrap("gemini-research-reply", generateText, {
        model: google(MODEL),
        system: `You are a rigorous research assistant helping a learner explore a Knowledge Sandbox titled "${session.sandbox.title}". Ground your answers in the provided sources, cite them inline by their bracketed labels (e.g. "[Source 1: …]") whenever you draw on them, and be candid about uncertainty or contradictions between sources. Keep replies focused and well-structured.

Sources:
${sourcesBlock}`,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });

      await step.run("record-research-reply-usage", () =>
        recordAiUsage({
          userId,
          kind: "RESEARCH_REPLY",
          model: MODEL,
          result: reply,
          resourceId: sessionId,
        }),
      );

      const replyText = (reply as { text: string }).text;

      await step.run("append-research-reply", async () => {
        const next: DiscussionMessage[] = [
          ...history,
          {
            role: "assistant",
            content: replyText,
            createdAt: new Date().toISOString(),
          },
        ];
        await prisma.researchSession.update({
          where: { id: sessionId },
          data: { chatHistory: next },
        });
      });

      await step.realtime.publish(
        "publish-research-ready",
        userChannel(userId).researchMessageReady,
        { sessionId, sandboxId },
      );

      return { sessionId };
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Generation failed";
      await step.realtime.publish(
        "publish-research-failed",
        userChannel(userId).researchMessageFailed,
        { sessionId, sandboxId, message },
      );
      throw err;
    }
  },
);

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

// One prompt-ready source for a Knowledge Sandbox Material. `content` is the
// extracted/typed body the model should synthesise + cite; `label` is the
// human-facing name used as the citation key.
type SandboxPromptSource = {
  label: string;
  kind: string;
  content: string;
};

// Cap how much source text we feed the model so a giant PDF doesn't blow the
// context window. Mirrors the conservative budget used by the continuity
// prompt builder.
const SANDBOX_SOURCE_CHAR_BUDGET = 6000;

// Resolve the sources a sandbox Material should cite. Reads the SandboxMaterial
// row for the lesson, then loads the selected SandboxSource rows (or every
// source in the sandbox when none were explicitly selected) and flattens each
// to a { label, kind, content } record. CONTINUITY_NOTE sources have their
// rich-text body fetched + stripped to plaintext.
async function loadSandboxMaterialSources(
  lessonId: string,
): Promise<SandboxPromptSource[]> {
  const material = await prisma.sandboxMaterial.findUnique({
    where: { lessonId },
    select: { sandboxId: true, sourceIds: true },
  });
  if (!material) return [];
  const selected = Array.isArray(material.sourceIds)
    ? (material.sourceIds as string[])
    : [];
  return loadSandboxSourcesByIds(material.sandboxId, selected);
}

// Load + flatten a sandbox's sources to prompt-ready records. An empty
// `selectedSourceIds` means "every source in the sandbox". Shared by the
// Material generator and the research-session reply function.
async function loadSandboxSourcesByIds(
  sandboxId: string,
  selectedSourceIds: string[],
): Promise<SandboxPromptSource[]> {
  const selected = selectedSourceIds;
  const sources = await prisma.sandboxSource.findMany({
    where: {
      sandboxId,
      ...(selected.length > 0 ? { id: { in: selected } } : {}),
    },
    orderBy: { order: "asc" },
    select: {
      kind: true,
      label: true,
      text: true,
      continuityNoteId: true,
      resource: { select: { title: true, content: true, url: true } },
    },
  });

  // Resolve continuity-note bodies in one batched query.
  const noteIds = sources
    .map((s) => s.continuityNoteId)
    .filter((id): id is string => Boolean(id));
  const notes =
    noteIds.length > 0
      ? await prisma.continuityNote.findMany({
          where: { id: { in: noteIds } },
          select: { id: true, content: true },
        })
      : [];
  const noteContentById = new Map(notes.map((n) => [n.id, n.content]));

  const out: SandboxPromptSource[] = [];
  for (const s of sources) {
    let content = "";
    if (s.kind === "TOPIC" || s.kind === "QUESTION" || s.kind === "THESIS") {
      content = s.text ?? "";
    } else if (s.kind === "CONTINUITY_NOTE" && s.continuityNoteId) {
      content = htmlToPlaintext(noteContentById.get(s.continuityNoteId) ?? "");
    } else if (s.resource) {
      content =
        s.resource.content ??
        (s.resource.url ? `External link: ${s.resource.url}` : "");
    }
    out.push({
      label: s.label || "Source",
      kind: s.kind,
      content: content.slice(0, SANDBOX_SOURCE_CHAR_BUDGET),
    });
  }
  return out;
}

// Build a source-grounded lesson prompt for a sandbox Material. The model is
// told to synthesise strictly from the provided sources and to cite them
// inline by label, finishing with a references list.
function buildSandboxMaterialPrompt(args: {
  sandboxTitle: string;
  lessonTitle: string;
  activity: LessonActivityType;
  sources: SandboxPromptSource[];
}): string {
  const typeInstruction =
    ACTIVITY_INSTRUCTIONS[args.activity] ?? ACTIVITY_INSTRUCTIONS.reading;
  const sourcesBlock = args.sources
    .map(
      (s, i) =>
        `[Source ${i + 1}: ${s.label}] (${s.kind})\n${s.content || "(no extracted text — reason from the title/label)"}`,
    )
    .join("\n\n---\n\n");
  return `Generate a single complete research Material for a Knowledge Sandbox.

Sandbox: ${args.sandboxTitle}
Material title: ${args.lessonTitle}
Activity type: ${args.activity}

You are given the learner's research sources below. Synthesise this Material strictly from these sources — do not invent facts that aren't supported by them. Cite sources inline using their bracketed labels (e.g. "[Source 1: …]") wherever you draw on them, and end the main body with a "References" section that lists every source you cited.

Sources:
${sourcesBlock}

Always populate the \`base\` field with the Material's title, summary, description, duration, objectives, and recommended resources.

${typeInstruction}

Do not populate any child field other than the one matching this activity type.`;
}

function buildLessonPrompt(args: {
  curriculumTitle: string;
  curriculumSubject: string;
  curriculumLevel: string;
  curriculumGoal: string;
  moduleTitle: string;
  moduleSummary: string;
  lessonTitle: string;
  lessonDescription: string;
  activity: LessonActivityType;
}): string {
  const typeInstruction = ACTIVITY_INSTRUCTIONS[args.activity] ?? ACTIVITY_INSTRUCTIONS.reading;
  return `Generate a single complete lesson.

Curriculum: ${args.curriculumTitle} (${args.curriculumSubject}, ${args.curriculumLevel})
Learner goal: ${args.curriculumGoal}
Module: ${args.moduleTitle} — ${args.moduleSummary}
Lesson title: ${args.lessonTitle}
Lesson description: ${args.lessonDescription}
Activity type: ${args.activity}

Always populate the \`base\` field with the lesson's title, summary, description, duration, objectives, and recommended resources.

${typeInstruction}

Do not populate any child field other than the one matching this activity type.`;
}

const ACTIVITY_INSTRUCTIONS: Record<LessonActivityType, string> = {
  reading: `Populate the \`reading\` field. The reading must include:
  - a 2-4 paragraph topic overview
  - a thorough deep-dive in markdown with multiple headings/subheadings, examples, and clear explanations`,
  quiz: `Populate the \`quiz\` field with PRE-ASSESSMENT study material only — DO NOT include any questions yet. The questions will be generated in a separate step when the learner is ready.
  - \`overview\`: a 2-4 paragraph topic overview that frames what the quiz will cover.
  - \`content\`: a focused markdown reading on the topic so the learner can study before testing themselves. Use headings, short examples, and key terms. No questions, no answer keys.
  - \`recommendedResources\`: a mix of resources. Include at least one of type 'article' or 'website' (rendered as a Google search) and at least one of type 'video' (rendered as a YouTube search) so the learner can read AND watch supporting material.`,
  exercise: `Populate the \`exercise\` field with PRE-ASSESSMENT study material only — DO NOT include any questions or hints yet; those are produced in a separate generation step.
  - \`description\` and \`instructions\`: short framing copy for the exercise.
  - \`overview\`: a 2-4 paragraph topic overview.
  - \`content\`: a focused markdown reading the learner can study before tackling the exercise.
  - \`recommendedResources\`: include at least one Google-searchable reading and at least one YouTube-searchable video.`,
  practice: `Populate the \`exercise\` field with PRE-ASSESSMENT study material only — DO NOT include any questions or hints yet; those are produced in a separate generation step.
  - \`description\` and \`instructions\`: short framing copy for the exercise.
  - \`overview\`: a 2-4 paragraph topic overview.
  - \`content\`: a focused markdown reading the learner can study before tackling the exercise.
  - \`recommendedResources\`: include at least one Google-searchable reading and at least one YouTube-searchable video.`,
  project: `Populate the \`project\` field. The objectives array is the rubric the learner will be graded against — each objective should be a concrete, demonstrable criterion. Choose a fitting projectType.`,
  video: `Populate the \`video\` field. Embedding real video URLs is unreliable, so write the overview as if the learner will search for a video on this topic themselves rather than referencing a specific clip you already picked. Leave \`embedUrl\` empty and set \`externalUrl\` to a YouTube search URL of the form \`https://www.youtube.com/results?search_query=<url-encoded query>\` using the most useful search terms for the topic. Also populate \`base.recommendedResources\` with high-quality further-reading resources (articles, books, courses) so the learner has supporting material beyond the video search.`,
  discussion: `Populate the \`discussion\` field. The openingMessage should be a thought-provoking opening prompt the AI tutor uses to start the conversation.`,
  other: `Populate the \`reading\` field as a fallback general lesson.`,
};

function normalizeQuestions(qs: QuizQuestion[]): QuizQuestion[] {
  return qs.map((q) => {
    // Defensive: clamp the correct index inside the answer array length so a
    // bad LLM output can't poison submissions.
    const max = Math.max(0, q.answers.length - 1);
    const idx = Math.max(0, Math.min(q.correctAnswerIndex, max));
    return { ...q, correctAnswerIndex: idx };
  });
}

function dbActivityToPrompt(
  type: string,
): LessonActivityType {
  switch (type) {
    case "VIDEO":
      return "video";
    case "QUIZ":
      return "quiz";
    case "EXERCISE":
      return "exercise";
    case "PROJECT":
      return "project";
    case "DISCUSSION":
      return "discussion";
    case "READING":
      return "reading";
    default:
      return "reading";
  }
}

function projectTypeToDb(
  type: import("./schemas").ProjectType,
): "PRESENTATION" | "REPORT" | "ARTICLE" | "ESSAY" | "RESEARCH_PAPER" | "THESIS" | "CODE_SNIPPET" | "CODE_PROJECT" | "OTHER" {
  switch (type) {
    case "presentation":
      return "PRESENTATION";
    case "report":
      return "REPORT";
    case "article":
      return "ARTICLE";
    case "essay":
      return "ESSAY";
    case "research paper":
      return "RESEARCH_PAPER";
    case "thesis":
      return "THESIS";
    case "code snippet":
      return "CODE_SNIPPET";
    case "code project":
      return "CODE_PROJECT";
    default:
      return "OTHER";
  }
}

