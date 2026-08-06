-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING GIN ("action" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs" USING GIN ("entityType" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "notifications_tenantId_type_entityId_createdAt_idx" ON "notifications"("tenantId", "type", "entityId", "createdAt");

-- CreateIndex
-- Partial unique index — Prisma's schema DSL can't express this (see the
-- comment above the Appointment model). Backs book-appointment.use-case.ts's
-- double-booking guard: findOverlapping is check-then-act and can't stop two
-- concurrent requests both seeing "no overlap"; this index is what actually
-- rejects the loser (as a P2002, caught and turned into a friendly error).
-- Matches findOverlapping's own status exclusion list exactly.
CREATE UNIQUE INDEX "appointments_no_double_booking" ON "appointments" ("tenantId", "doctorId", "appointmentDate", "appointmentTime") WHERE "isDeleted" = false AND "status" NOT IN ('CANCELLED', 'NO_SHOW');
