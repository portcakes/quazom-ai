import { channel } from "inngest/realtime";
import { z } from "zod";

export const userChannel = channel({
  name: (userId: string) => `user:${userId}`,
  topics: {
    curriculumReady: {
      schema: z.object({
        id: z.string(),
        title: z.string(),
      }),
    },
    // Fired once a lesson's full content + per-type child row are persisted and
    // the lesson is `READY`. The `/lessons/[id]` page polls until this lands.
    lessonReady: {
      schema: z.object({
        id: z.string(),
        title: z.string(),
      }),
    },
    // Fired on lesson generation failure so the UI can surface it.
    lessonFailed: {
      schema: z.object({
        id: z.string(),
        message: z.string(),
      }),
    },
    // Fired after Quiz/Exercise feedback is generated.
    feedbackReady: {
      schema: z.object({
        kind: z.enum(["quiz", "exercise"]),
        id: z.string(),
        lessonId: z.string(),
      }),
    },
    // Fired after the AI tutor replies in a discussion.
    discussionMessageReady: {
      schema: z.object({
        discussionId: z.string(),
        lessonId: z.string(),
      }),
    },
    // Fired after the AI replies in a Knowledge Sandbox research session.
    researchMessageReady: {
      schema: z.object({
        sessionId: z.string(),
        sandboxId: z.string(),
      }),
    },
    // Fired when a research-session reply throws so the chat can surface it.
    researchMessageFailed: {
      schema: z.object({
        sessionId: z.string(),
        sandboxId: z.string(),
        message: z.string(),
      }),
    },
    // Fired after the phase-2 quiz/exercise question generation succeeds so
    // the lesson page can refresh and reveal the questions section.
    assessmentReady: {
      schema: z.object({
        kind: z.enum(["quiz", "exercise"]),
        id: z.string(),
        lessonId: z.string(),
      }),
    },
    // Fired when the phase-2 question generation throws so the UI can
    // surface the error and offer a retry.
    assessmentFailed: {
      schema: z.object({
        kind: z.enum(["quiz", "exercise"]),
        id: z.string(),
        lessonId: z.string(),
        message: z.string(),
      }),
    },
    // Fired when the curriculum row finishes generation but its Inngest
    // function returned a parse/validation error. Lets the detail page
    // render a retry CTA without polling the row in FAILED state forever.
    curriculumFailed: {
      schema: z.object({
        id: z.string(),
        message: z.string(),
      }),
    },
    // Fired when the "generate thesis from continuity notes" call returns.
    // The modal listens with a `requestId` so concurrent thesis generations
    // (different note picks) don't clobber each other.
    thesisReady: {
      schema: z.object({
        requestId: z.string(),
        thesis: z.string(),
      }),
    },
    // Fired when thesis generation throws so the modal can surface the
    // failure and let the user retry or write one by hand instead.
    thesisFailed: {
      schema: z.object({
        requestId: z.string(),
        message: z.string(),
      }),
    },
  },
});

// All topics the client can subscribe to. Listed here so the realtime token
// procedure and the UI hooks stay in sync.
export const userChannelTopics = [
  "curriculumReady",
  "curriculumFailed",
  "lessonReady",
  "lessonFailed",
  "feedbackReady",
  "discussionMessageReady",
  "researchMessageReady",
  "researchMessageFailed",
  "assessmentReady",
  "assessmentFailed",
  "thesisReady",
  "thesisFailed",
] as const;
