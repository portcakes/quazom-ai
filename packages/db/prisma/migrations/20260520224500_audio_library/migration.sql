-- Persistent TTS audio library + playback queue.
-- Adds the GeneratedAudio table (the cached audio clips themselves) and
-- AudioPlaylistItem (a single user-scoped queue/playlist).

CREATE TYPE "AudioSourceKind" AS ENUM (
    'LESSON_OVERVIEW',
    'LESSON_READING',
    'LESSON_VIDEO_OVERVIEW',
    'LESSON_QUIZ_OVERVIEW',
    'LESSON_QUIZ_READING',
    'RESOURCE_READER',
    'CURRICULUM_OVERVIEW',
    'COURSE_OBJECTIVES',
    'GENERIC'
);

CREATE TABLE "generated_audio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL,
    "voice" TEXT NOT NULL DEFAULT 'Kore',
    "model" TEXT NOT NULL,
    "sourceKind" "AudioSourceKind" NOT NULL,
    "lessonId" TEXT,
    "curriculumId" TEXT,
    "resourceId" TEXT,
    "title" TEXT NOT NULL,
    "section" TEXT,
    "audioKey" TEXT NOT NULL,
    "audioMimeType" TEXT NOT NULL DEFAULT 'audio/wav',
    "audioBytes" INTEGER NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "characterCount" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_audio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generated_audio_userId_contextKey_key"
    ON "generated_audio"("userId", "contextKey");
CREATE INDEX "generated_audio_userId_idx" ON "generated_audio"("userId");
CREATE INDEX "generated_audio_userId_createdAt_idx"
    ON "generated_audio"("userId", "createdAt");
CREATE INDEX "generated_audio_userId_lessonId_idx"
    ON "generated_audio"("userId", "lessonId");
CREATE INDEX "generated_audio_userId_curriculumId_idx"
    ON "generated_audio"("userId", "curriculumId");
CREATE INDEX "generated_audio_userId_resourceId_idx"
    ON "generated_audio"("userId", "resourceId");

ALTER TABLE "generated_audio"
    ADD CONSTRAINT "generated_audio_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "generated_audio"
    ADD CONSTRAINT "generated_audio_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "lesson"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_audio"
    ADD CONSTRAINT "generated_audio_curriculumId_fkey"
    FOREIGN KEY ("curriculumId") REFERENCES "curriculum"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_audio"
    ADD CONSTRAINT "generated_audio_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "resource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "audio_playlist_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_playlist_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audio_playlist_item_userId_audioId_key"
    ON "audio_playlist_item"("userId", "audioId");
CREATE INDEX "audio_playlist_item_userId_position_idx"
    ON "audio_playlist_item"("userId", "position");

ALTER TABLE "audio_playlist_item"
    ADD CONSTRAINT "audio_playlist_item_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audio_playlist_item"
    ADD CONSTRAINT "audio_playlist_item_audioId_fkey"
    FOREIGN KEY ("audioId") REFERENCES "generated_audio"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
