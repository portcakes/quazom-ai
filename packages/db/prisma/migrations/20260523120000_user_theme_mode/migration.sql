-- Cross-device appearance preference.
-- SYSTEM defers to the OS-level prefers-color-scheme at render time.
-- New users default to LIGHT so a brand-new account always boots into
-- the canonical paper-coloured UI.

CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

ALTER TABLE "user"
    ADD COLUMN "themeMode" "ThemeMode" NOT NULL DEFAULT 'LIGHT';
