/**
 * Get Postnatal Worklist Use Case
 *
 * Clinic-wide "PNC contacts due/overdue" worklist — same computed-on-read
 * approach as the immunization due-list (see
 * immunization.controller.ts#getOverdueImmunizations): the WHO/Nigeria PNC
 * schedule's 4 expected contact dates (24h / day 3 / week 1 / week 6) are
 * computed from each delivered LaborRecord's deliveredAt, then diffed
 * against whatever PostnatalVisit rows already exist — no placeholder rows.
 *
 * Matches recorded visits to a delivery by (patientId, pregnancyId); a
 * walk-in delivery with no pregnancy record (pregnancyId null) is matched by
 * patientId alone, so two such deliveries for the same mother within the
 * 6-week PNC window would be conflated — an accepted edge case at this
 * scale, same tradeoff the immunization due-list already makes.
 */

import { PncContactType, PrismaClient } from '@prisma/client';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const CONTACT_OFFSETS: Array<{ type: PncContactType; hours: number }> = [
  { type: 'PNC_24H', hours: 24 },
  { type: 'PNC_DAY3', hours: 72 },
  { type: 'PNC_WEEK1', hours: 24 * 7 },
  { type: 'PNC_WEEK6', hours: 24 * 42 },
];

export class GetPostnatalWorklistUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, withinDays: number = 7) {
    const cutoff = new Date(Date.now() + withinDays * MS_PER_DAY);

    // The PNC schedule's last contact (WEEK6) is 42 days post-delivery — the
    // whole episode is clinically closed after that, so a delivery older
    // than 6 weeks can't have any contact still "due" (same plausibility-
    // bound approach the immunization due-list uses via patient age).
    // Without this, every delivery ever recorded at this clinic gets
    // fetched and diffed on every worklist load, growing unboundedly over
    // the years even though the vast majority are long past being
    // actionable.
    const sixWeeksAgo = new Date(Date.now() - 42 * MS_PER_DAY);

    const deliveredLabors = await this.prisma.laborRecord.findMany({
      where: { tenantId, status: 'DELIVERED', deliveredAt: { not: null, gte: sixWeeksAgo }, isDeleted: false },
      select: {
        id: true,
        patientId: true,
        pregnancyId: true,
        deliveredAt: true,
        patient: { select: { id: true, firstName: true, lastName: true, patientId: true } },
      },
    });

    const motherPatientIds = [...new Set(deliveredLabors.map((labor) => labor.patientId))];

    const [recordedVisits, dismissals] = await Promise.all([
      this.prisma.postnatalVisit.findMany({
        where: { tenantId, isDeleted: false, patientId: { in: motherPatientIds } },
        select: { patientId: true, pregnancyId: true, contactType: true },
      }),
      this.prisma.worklistDismissal.findMany({
        where: { tenantId, worklistType: 'POSTNATAL_DUE', patientId: { in: motherPatientIds } },
        select: { patientId: true, pregnancyId: true, contactType: true },
      }),
    ]);

    const recordedKeys = new Set(recordedVisits.map((v) => `${v.patientId}:${v.pregnancyId ?? ''}:${v.contactType}`));
    const dismissedKeys = new Set(dismissals.map((d) => `${d.patientId}:${d.pregnancyId ?? ''}:${d.contactType}`));

    const due = deliveredLabors.flatMap((labor) =>
      CONTACT_OFFSETS.filter(
        (offset) =>
          !recordedKeys.has(`${labor.patientId}:${labor.pregnancyId ?? ''}:${offset.type}`) &&
          !dismissedKeys.has(`${labor.patientId}:${labor.pregnancyId ?? ''}:${offset.type}`)
      )
        .map((offset) => ({
          offset,
          expectedDate: new Date(labor.deliveredAt!.getTime() + offset.hours * MS_PER_HOUR),
        }))
        .filter(({ expectedDate }) => expectedDate <= cutoff)
        .map(({ offset, expectedDate }) => ({
          id: `due-${labor.id}-${offset.type}`,
          patientId: labor.patientId,
          pregnancyId: labor.pregnancyId,
          laborRecordId: labor.id,
          contactType: offset.type,
          expectedDate: expectedDate.toISOString(),
          patient: {
            id: labor.patient.id,
            firstName: labor.patient.firstName,
            lastName: labor.patient.lastName,
            patientId: labor.patient.patientId,
          },
        }))
    );

    return due.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());
  }
}
