/*
  Warnings:

  - Added the required column `summary` to the `curriculum` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "curriculum" ADD COLUMN     "summary" JSONB NOT NULL;
