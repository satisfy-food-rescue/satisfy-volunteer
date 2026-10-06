-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('ADMIN', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VolunteerRole" AS ENUM ('WAREHOUSE', 'DRIVERS_ASSISTANT', 'VOLUNTEER_DRIVER');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('REGULAR', 'BOOKED', 'COVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('CONFIRMED', 'RELEASED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AbsenceReason" AS ENUM ('HOLIDAY', 'SICK', 'OTHER');

-- CreateEnum
CREATE TYPE "Delivery" AS ENUM ('IN_PERSON', 'ONLINE_CONFIRM');

-- CreateEnum
CREATE TYPE "TrainingMethod" AS ENUM ('SESSION', 'ONLINE', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'DECLINED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "EmailKind" AS ENUM ('TRAINING_DUE_SOON', 'TRAINING_OVERDUE', 'TRAINING_OVERDUE_COORDINATOR', 'SHIFT_REMINDER', 'ABSENCE_CONFIRMED', 'COVER_CONFIRMED', 'GAP_ALERT', 'APPLICATION_APPROVED', 'TRAINING_COMPLETED', 'SESSION_CONFIRMED', 'HARVEST_CALLOUT', 'LAST_MINUTE_CALLOUT', 'GAP_ESCALATION', 'ROLES_CHANGED', 'ROLE_CHANGE_REQUEST', 'ACCOUNT_INVITE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CAPTURED');

-- CreateEnum
CREATE TYPE "ContactLogKind" AS ENUM ('CALL', 'NOTE', 'PROFILE_UPDATED', 'ROLES_CHANGED', 'VISIT_BOOKED', 'ROLE_REQUEST', 'ACCOUNT_CREATED', 'STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('INVITE', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "Volunteer" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "suburb" TEXT,
    "birthYear" INTEGER,
    "role" "AccountRole" NOT NULL DEFAULT 'VOLUNTEER',
    "status" "VolunteerStatus" NOT NULL DEFAULT 'ACTIVE',
    "roles" "VolunteerRole"[] DEFAULT ARRAY['WAREHOUSE']::"VolunteerRole"[],
    "isRegular" BOOLEAN NOT NULL DEFAULT false,
    "inHarvestPool" BOOLEAN NOT NULL DEFAULT false,
    "lastMinuteOk" BOOLEAN NOT NULL DEFAULT false,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "availabilityNote" TEXT,
    "notes" TEXT,
    "joinedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "infoodleId" TEXT,
    "infoodleSyncedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastSignInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "isVolunteerDriven" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "kind" "VolunteerRole" NOT NULL,
    "name" TEXT NOT NULL,
    "routeId" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "needed" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "workingWith" TEXT,
    "lastMinuteHours" INTEGER NOT NULL DEFAULT 48,
    "escalateHours" INTEGER NOT NULL DEFAULT 24,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "needed" INTEGER NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegularSlot" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,

    CONSTRAINT "RegularSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "source" "AssignmentSource" NOT NULL DEFAULT 'BOOKED',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "absenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" "AbsenceReason" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "validityMonths" INTEGER,
    "requiredRoles" "VolunteerRole"[],
    "mandatoryBeforeFirstShift" BOOLEAN NOT NULL DEFAULT false,
    "delivery" "Delivery" NOT NULL,
    "content" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedAt" DATE NOT NULL,
    "expiresAt" DATE,
    "method" "TrainingMethod" NOT NULL,
    "sessionId" TEXT,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRsvp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL DEFAULT 'GOING',
    "attendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestCallout" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "needed" INTEGER NOT NULL,

    CONSTRAINT "HarvestCallout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestRsvp" (
    "id" TEXT NOT NULL,
    "calloutId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HarvestRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "suburb" TEXT,
    "birthYear" INTEGER,
    "interests" "VolunteerRole"[],
    "availability" TEXT NOT NULL,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'INFOODLE_FORM',
    "infoodleId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "volunteerId" TEXT,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT,
    "channel" "Channel" NOT NULL DEFAULT 'EMAIL',
    "toName" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "kind" "EmailKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "ref" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "ContactLogKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_email_key" ON "Volunteer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_volunteerId_idx" ON "Session"("volunteerId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_volunteerId_purpose_idx" ON "AuthToken"("volunteerId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_volunteerId_idx" ON "Passkey"("volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_volunteerId_provider_key" ON "OAuthAccount"("volunteerId", "provider");

-- CreateIndex
CREATE INDEX "Shift_date_idx" ON "Shift"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_templateId_date_key" ON "Shift"("templateId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RegularSlot_volunteerId_templateId_weekday_key" ON "RegularSlot"("volunteerId", "templateId", "weekday");

-- CreateIndex
CREATE INDEX "Assignment_shiftId_idx" ON "Assignment"("shiftId");

-- CreateIndex
CREATE INDEX "Assignment_volunteerId_idx" ON "Assignment"("volunteerId");

-- CreateIndex
CREATE INDEX "Absence_startDate_endDate_idx" ON "Absence"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingModule_code_key" ON "TrainingModule"("code");

-- CreateIndex
CREATE INDEX "TrainingRecord_volunteerId_idx" ON "TrainingRecord"("volunteerId");

-- CreateIndex
CREATE INDEX "TrainingRecord_expiresAt_idx" ON "TrainingRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRsvp_sessionId_volunteerId_key" ON "SessionRsvp"("sessionId", "volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "HarvestRsvp_calloutId_volunteerId_key" ON "HarvestRsvp"("calloutId", "volunteerId");

-- CreateIndex
CREATE INDEX "Email_createdAt_idx" ON "Email"("createdAt");

-- CreateIndex
CREATE INDEX "Email_ref_idx" ON "Email"("ref");

-- CreateIndex
CREATE INDEX "Email_volunteerId_createdAt_idx" ON "Email"("volunteerId", "createdAt");

-- CreateIndex
CREATE INDEX "Email_status_createdAt_idx" ON "Email"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactLog_volunteerId_createdAt_idx" ON "ContactLog"("volunteerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passkey" ADD CONSTRAINT "Passkey_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donor" ADD CONSTRAINT "Donor_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularSlot" ADD CONSTRAINT "RegularSlot_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegularSlot" ADD CONSTRAINT "RegularSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "Absence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRsvp" ADD CONSTRAINT "SessionRsvp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRsvp" ADD CONSTRAINT "SessionRsvp_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestRsvp" ADD CONSTRAINT "HarvestRsvp_calloutId_fkey" FOREIGN KEY ("calloutId") REFERENCES "HarvestCallout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestRsvp" ADD CONSTRAINT "HarvestRsvp_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Volunteer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
