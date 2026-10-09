export type ObservationResult = 'STABLE' | 'SOMETIMES_NEEDS_HELP' | 'NEEDS_REGULAR_SUPPORT';
export type MonitoringState = 'STABLE' | 'WATCH' | 'REACTIVATION_REVIEW' | 'OVERDUE';

export function monitoringState(input: {
  approvedAt: Date;
  lastObservedAt: Date | null;
  monitoringIntervalDays: number;
  observations: readonly { result: ObservationResult; observedAt: Date }[];
  now: Date;
}): MonitoringState {
  const sorted = [...input.observations].sort(
    (a, b) => b.observedAt.getTime() - a.observedAt.getTime(),
  );
  // A repeated, unbroken run of regular-support observations merits a review, not reactivation.
  if (
    sorted.length >= 2 &&
    sorted[0]?.result === 'NEEDS_REGULAR_SUPPORT' &&
    sorted[1]?.result === 'NEEDS_REGULAR_SUPPORT'
  )
    return 'REACTIVATION_REVIEW';
  if (sorted[0] && sorted[0].result !== 'STABLE') return 'WATCH';

  const anchor = input.lastObservedAt ?? input.approvedAt;
  if (input.now.getTime() > anchor.getTime() + input.monitoringIntervalDays * 86400000) {
    return 'OVERDUE';
  }
  return 'STABLE';
}
