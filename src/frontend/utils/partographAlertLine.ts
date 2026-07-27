/**
 * WHO partograph alert/action line math (client-side).
 *
 * Alert line rises 1cm/hour from 4cm at active-phase onset. Action line is
 * parallel, 4 hours behind the alert line. Hand-mirrored on the backend
 * (record-partograph-observation.use-case.ts) for the notification check —
 * same duplication this codebase already accepts for ANC/lab thresholds
 * that only exist on one side of the stack.
 */

const MS_PER_HOUR = 60 * 60 * 1000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface AlertActionLineValues {
  alertLine: number | null;
  actionLine: number | null;
}

/**
 * Values of the alert/action lines at a given time. Both are null until
 * active-phase onset has been recorded — the chart should skip drawing
 * these series entirely in that case, not draw them at 0.
 */
export function getAlertActionLineValues(activePhaseOnsetAt: Date | null, at: Date): AlertActionLineValues {
  if (!activePhaseOnsetAt) return { alertLine: null, actionLine: null };

  const elapsedHours = (at.getTime() - activePhaseOnsetAt.getTime()) / MS_PER_HOUR;
  const alertLine = clamp(4 + elapsedHours * 1, 4, 10);
  const actionLine = elapsedHours < 4 ? null : clamp(4 + (elapsedHours - 4) * 1, 4, 10);

  return { alertLine, actionLine };
}

export function crossesActionLine(activePhaseOnsetAt: Date | null, at: Date, observedDilation: number | null | undefined): boolean {
  if (observedDilation == null) return false;
  const { actionLine } = getAlertActionLineValues(activePhaseOnsetAt, at);
  return actionLine !== null && observedDilation < actionLine;
}
