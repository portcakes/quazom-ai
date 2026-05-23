-- AlterTable: add free-form tags array to continuity_note, mirroring the
-- shape of `note.tags`. Default to the empty array so existing rows aren't
-- left NULL and the UI can iterate without a guard.
ALTER TABLE "continuity_note"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
