/**
 * Reputation presentation rules. All values come from real order and review
 * data (public.get_specialist_reputation). When a metric has too little data
 * it is shown as "Not enough data yet" rather than a misleading number.
 */

export const MIN_SAMPLE_FOR_RATE = 3;

export interface Reputation {
  completedOrders: number;
  ratingAvg: number | null;
  ratingCount: number;
  onTimeRate: number | null;
  onTimeSample: number;
  repeatClients: number;
  cancellationRate: number | null;
  cancellationSample: number;
}

export type MetricDisplay = { kind: "value"; value: string } | { kind: "insufficient" };

const NOT_ENOUGH: MetricDisplay = { kind: "insufficient" };

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function displayRating(rep: Pick<Reputation, "ratingAvg" | "ratingCount">): MetricDisplay {
  if (rep.ratingAvg === null || rep.ratingCount === 0) return NOT_ENOUGH;
  return { kind: "value", value: `${rep.ratingAvg.toFixed(1)} (${rep.ratingCount} review${rep.ratingCount === 1 ? "" : "s"})` };
}

export function displayOnTime(rep: Pick<Reputation, "onTimeRate" | "onTimeSample">): MetricDisplay {
  if (rep.onTimeRate === null || rep.onTimeSample < MIN_SAMPLE_FOR_RATE) return NOT_ENOUGH;
  return { kind: "value", value: percent(rep.onTimeRate) };
}

export function displayCancellation(rep: Pick<Reputation, "cancellationRate" | "cancellationSample">): MetricDisplay {
  if (rep.cancellationRate === null || rep.cancellationSample < MIN_SAMPLE_FOR_RATE) return NOT_ENOUGH;
  return { kind: "value", value: percent(rep.cancellationRate) };
}

export function toReputation(row: {
  completed_orders: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  on_time_rate: number | null;
  on_time_sample: number | null;
  repeat_clients: number | null;
  cancellation_rate: number | null;
  cancellation_sample: number | null;
}): Reputation {
  return {
    completedOrders: row.completed_orders ?? 0,
    ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
    ratingCount: row.rating_count ?? 0,
    onTimeRate: row.on_time_rate === null ? null : Number(row.on_time_rate),
    onTimeSample: row.on_time_sample ?? 0,
    repeatClients: row.repeat_clients ?? 0,
    cancellationRate: row.cancellation_rate === null ? null : Number(row.cancellation_rate),
    cancellationSample: row.cancellation_sample ?? 0,
  };
}
