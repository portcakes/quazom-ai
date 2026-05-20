-- Add TTS feature kind to the AiUsage telemetry enum so the admin
-- dashboard can break out tokens spent on Gemini text-to-speech calls.
ALTER TYPE "AiUsageKind" ADD VALUE 'TTS';
