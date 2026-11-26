-- New enum values get their own migration: Postgres cannot use a value in the
-- transaction that adds it, and the next migration backfills with them.

-- AlterEnum
ALTER TYPE "VolunteerRole" ADD VALUE 'TRAINING' BEFORE 'WAREHOUSE';

-- AlterEnum
ALTER TYPE "TrainingMethod" ADD VALUE 'NOT_APPLICABLE';
