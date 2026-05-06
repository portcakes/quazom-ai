/*
  Warnings:

  - Added the required column `estimatedDuration` to the `curriculum` table without a default value. This is not possible if the table is not empty.
  - Added the required column `modules` to the `curriculum` table without a default value. This is not possible if the table is not empty.
  - Added the required column `objectives` to the `curriculum` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recommendedResources` to the `curriculum` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "curriculum" ADD COLUMN     "estimatedDuration" TEXT NOT NULL,
ADD COLUMN     "modules" JSONB NOT NULL,
ADD COLUMN     "objectives" JSONB NOT NULL,
ADD COLUMN     "recommendedResources" JSONB NOT NULL;
