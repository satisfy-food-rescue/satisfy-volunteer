-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('AGREEMENT', 'POLICY');

-- AlterEnum
ALTER TYPE "AnnouncementAudience" ADD VALUE 'SHIFT_TYPE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactLogKind" ADD VALUE 'MOJ_CHECK';
ALTER TYPE "ContactLogKind" ADD VALUE 'AGREEMENT_SIGNED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailKind" ADD VALUE 'MOJ_CHECK_RECORDED';
ALTER TYPE "EmailKind" ADD VALUE 'MOJ_CHECK_RENEWAL';
ALTER TYPE "EmailKind" ADD VALUE 'MOJ_CHECK_RENEWAL_COORDINATOR';
ALTER TYPE "EmailKind" ADD VALUE 'DOCUMENT_UPDATED';

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "TrainingModule" ADD COLUMN     "inDevelopment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prerequisiteId" TEXT;

-- AlterTable
ALTER TABLE "Volunteer" ADD COLUMN     "alsoVolunteers" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MojCheck" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "checkedOn" DATE NOT NULL,
    "recordedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MojCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT,
    "body" TEXT,
    "roles" "VolunteerRole"[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionNote" TEXT,
    "versionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAcknowledgement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mojCheckRoles" "VolunteerRole"[] DEFAULT ARRAY[]::"VolunteerRole"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "MojCheck_volunteerId_checkedOn_idx" ON "MojCheck"("volunteerId", "checkedOn");

-- CreateIndex
CREATE INDEX "DocumentAcknowledgement_volunteerId_idx" ON "DocumentAcknowledgement"("volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAcknowledgement_documentId_volunteerId_version_key" ON "DocumentAcknowledgement"("documentId", "volunteerId", "version");

-- AddForeignKey
ALTER TABLE "TrainingModule" ADD CONSTRAINT "TrainingModule_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "TrainingModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MojCheck" ADD CONSTRAINT "MojCheck_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MojCheck" ADD CONSTRAINT "MojCheck_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAcknowledgement" ADD CONSTRAINT "DocumentAcknowledgement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAcknowledgement" ADD CONSTRAINT "DocumentAcknowledgement_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Coordinators who have already booked a shift or done training volunteer
-- too, so they join the volunteer lists they were missing from.
UPDATE "Volunteer" v SET "alsoVolunteers" = true
WHERE v."role" = 'ADMIN'
  AND (EXISTS (SELECT 1 FROM "Assignment" a WHERE a."volunteerId" = v."id")
    OR EXISTS (SELECT 1 FROM "TrainingRecord" t WHERE t."volunteerId" = v."id")
    OR EXISTS (SELECT 1 FROM "SessionRsvp" r WHERE r."volunteerId" = v."id"));
