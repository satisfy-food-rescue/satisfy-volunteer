-- Meeting 26 Nov 2026: every new volunteer starts in training, role changes
-- are dated, and an agreement can be read and understood instead of signed.

-- CreateEnum
CREATE TYPE "DocumentAcceptance" AS ENUM ('SIGN', 'READ');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "acceptance" "DocumentAcceptance" NOT NULL DEFAULT 'SIGN';

-- AlterTable
ALTER TABLE "Volunteer" ALTER COLUMN "roles" SET DEFAULT ARRAY['TRAINING']::"VolunteerRole"[];

-- CreateTable
CREATE TABLE "RolePeriod" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "role" "VolunteerRole" NOT NULL,
    "startedOn" DATE NOT NULL,
    "endedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolePeriod_volunteerId_role_idx" ON "RolePeriod"("volunteerId", "role");

-- AddForeignKey
ALTER TABLE "RolePeriod" ADD CONSTRAINT "RolePeriod_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: the roles people hold now, from the day they joined. Coordinators
-- can correct a start date on the profile.
INSERT INTO "RolePeriod" ("id", "volunteerId", "role", "startedOn")
SELECT gen_random_uuid()::text, v."id", r.role, v."joinedAt"
FROM "Volunteer" v CROSS JOIN LATERAL unnest(v."roles") AS r(role)
WHERE v."status" <> 'DELETED';

-- Trainees need what every regular role needs before they start: the
-- induction (Ministry of Justice check and agreements) and the training all
-- regular roles share. Role arrays are kept in display order, which starts
-- with TRAINING.
UPDATE "TrainingModule"
SET "requiredRoles" = array_prepend('TRAINING'::"VolunteerRole", "requiredRoles")
WHERE "requiredRoles" @> ARRAY['WAREHOUSE', 'DRIVERS_ASSISTANT', 'VOLUNTEER_DRIVER']::"VolunteerRole"[]
  AND NOT ('TRAINING' = ANY ("requiredRoles"));

UPDATE "Document"
SET "roles" = array_prepend('TRAINING'::"VolunteerRole", "roles")
WHERE "kind" = 'AGREEMENT'
  AND "roles" && ARRAY['WAREHOUSE', 'DRIVERS_ASSISTANT', 'VOLUNTEER_DRIVER']::"VolunteerRole"[]
  AND NOT ('TRAINING' = ANY ("roles"));

UPDATE "Settings"
SET "mojCheckRoles" = array_prepend('TRAINING'::"VolunteerRole", "mojCheckRoles")
WHERE "mojCheckRoles" && ARRAY['WAREHOUSE', 'DRIVERS_ASSISTANT', 'VOLUNTEER_DRIVER']::"VolunteerRole"[]
  AND NOT ('TRAINING' = ANY ("mojCheckRoles"));
