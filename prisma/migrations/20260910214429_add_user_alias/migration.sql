/*
  Warnings:

  - A unique constraint covering the columns `[alias]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `alias` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- Add the column first so existing users can receive deterministic aliases.
ALTER TABLE "User" ADD COLUMN "alias" VARCHAR(40);

UPDATE "User"
SET "alias" = left(lower(regexp_replace(split_part("email", '@', 1), '[^a-zA-Z0-9._-]', '', 'g')), 30)
  || '_'
  || left("id", 8);

ALTER TABLE "User" ALTER COLUMN "alias" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_alias_key" ON "User"("alias");
