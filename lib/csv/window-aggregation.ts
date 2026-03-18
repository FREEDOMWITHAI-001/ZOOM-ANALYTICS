// Utility for aggregating minute-level engagement data into N-minute windows
// and detecting peaks/dropoffs dynamically based on user-selected interval.

export interface RawEngagementGraph {
  granularity?: string;
  granularity_minutes?: number;
  labels: string[];
  timestamps?: string[];
  active_participants: number[];
  users_joined?: number[];
  users_left?: number[];
}

export interface TranscriptMoment {
  time_seconds: number;
  time_label: string;
  summary: string;
  recommendation: string;
}

export interface AggregatedPeak {
  timeInterval: string;
  count: number;
  percentageChange: number;
  bucketStartMinute: number;
  bucketEndMinute: number;
  description?: string;
}

export interface AggregatedWindowResult {
  labels: string[];
  active: number[];
  joined: number[];
  left: number[];
  peaks: AggregatedPeak[];
  dropoffs: AggregatedPeak[];
}

function formatMinutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Aggregates raw minute-level engagement arrays into N-minute buckets.
 * Detects peaks (>3% increase) and dropoffs (>3% decrease) skipping
 * the first 10 minutes and last 20 minutes (noise zones).
 */
export function aggregateMinuteData(
  rawGraph: RawEngagementGraph,
  windowMinutes: number
): AggregatedWindowResult {
  const { active_participants, users_joined = [], users_left = [] } = rawGraph;

  if (!active_participants || active_participants.length === 0) {
    return { labels: [], active: [], joined: [], left: [], peaks: [], dropoffs: [] };
  }

  const totalMinutes = active_participants.length;
  const window = Math.max(1, windowMinutes);

  const labels: string[] = [];
  const active: number[] = [];
  const joined: number[] = [];
  const left: number[] = [];

  for (let start = 0; start < totalMinutes; start += window) {
    const end = Math.min(start + window, totalMinutes);
    const slice = active_participants.slice(start, end);
    const joinedSlice = users_joined.slice(start, end);
    const leftSlice = users_left.slice(start, end);

    const avgActive = slice.reduce((s, v) => s + v, 0) / slice.length;
    const sumJoined = joinedSlice.reduce((s, v) => s + v, 0);
    const sumLeft = leftSlice.reduce((s, v) => s + v, 0);

    labels.push(`${formatMinutesToHHMM(start)}-${formatMinutesToHHMM(end)}`);
    active.push(Math.round(avgActive));
    joined.push(sumJoined);
    left.push(sumLeft);
  }

  // Detect peaks and dropoffs (skip noise zones)
  const skipFirstBuckets = Math.ceil(10 / window);  // skip first 10 min
  const skipLastBuckets = Math.ceil(20 / window);   // skip last 20 min
  const effectiveEnd = labels.length - skipLastBuckets;

  const rawPeaks: AggregatedPeak[] = [];
  const rawDropoffs: AggregatedPeak[] = [];

  for (let i = Math.max(1, skipFirstBuckets); i < effectiveEnd; i++) {
    const prev = active[i - 1];
    const curr = active[i];
    if (prev <= 0) continue;

    const pctChange = ((curr - prev) / prev) * 100;
    const bucketStartMinute = i * window;
    const bucketEndMinute = Math.min((i + 1) * window, totalMinutes);

    if (pctChange > 3) {
      rawPeaks.push({
        timeInterval: labels[i],
        count: curr,
        percentageChange: Math.round(pctChange),
        bucketStartMinute,
        bucketEndMinute,
      });
    } else if (pctChange < -3) {
      rawDropoffs.push({
        timeInterval: labels[i],
        count: curr,
        percentageChange: Math.round(pctChange),
        bucketStartMinute,
        bucketEndMinute,
      });
    }
  }

  // Sort and take top 5
  rawPeaks.sort((a, b) => b.percentageChange - a.percentageChange);
  rawDropoffs.sort((a, b) => a.percentageChange - b.percentageChange);

  return {
    labels,
    active,
    joined,
    left,
    peaks: rawPeaks.slice(0, 5),
    dropoffs: rawDropoffs.slice(0, 5),
  };
}

/**
 * Matches a transcript moment to a peak/dropoff bucket.
 * Tries exact bucket range first, then ±3 min nearest match,
 * then returns a deterministic fallback description.
 */
export function matchTranscriptMoment(
  moments: TranscriptMoment[],
  bucketStartMinute: number,
  bucketEndMinute: number,
  changeType: "peak" | "dropoff",
  percentageChange: number
): string {
  if (!moments || moments.length === 0) {
    return getDefaultDescription(changeType, percentageChange, bucketStartMinute);
  }

  const bucketStartSec = bucketStartMinute * 60;
  const bucketEndSec = bucketEndMinute * 60;

  // Exact bucket match
  const exactMatch = moments.find(
    (m) => m.time_seconds >= bucketStartSec && m.time_seconds < bucketEndSec
  );
  if (exactMatch) return exactMatch.summary;

  // ±3 min nearest match
  const threeMinSec = 3 * 60;
  const nearby = moments
    .map((m) => ({
      moment: m,
      dist: Math.min(
        Math.abs(m.time_seconds - bucketStartSec),
        Math.abs(m.time_seconds - bucketEndSec)
      ),
    }))
    .filter((x) => x.dist <= threeMinSec)
    .sort((a, b) => a.dist - b.dist);

  if (nearby.length > 0) return nearby[0].moment.summary;

  return getDefaultDescription(changeType, percentageChange, bucketStartMinute);
}

function getDefaultDescription(
  changeType: "peak" | "dropoff",
  percentageChange: number,
  startMinute: number
): string {
  const time = formatMinutesToHHMM(startMinute);
  if (changeType === "peak") {
    const descs = [
      `Engagement spike at ${time} — likely interactive content`,
      `Participant increase at ${time} — possibly Q&A session`,
      `Attention boost at ${time} — key content delivered`,
      `Retention peak at ${time} — audience engaged`,
      `Viewer surge at ${time} — scheduled joiners arrived`,
    ];
    return descs[Math.abs(percentageChange) % descs.length];
  } else {
    const descs = [
      `Drop-off at ${time} — check technical issues`,
      `Audience decline at ${time} — content transition`,
      `Engagement dip at ${time} — complex topic`,
      `Participant decrease at ${time} — break time`,
      `Attention drop at ${time} — lengthy explanation`,
    ];
    return descs[Math.abs(percentageChange) % descs.length];
  }
}
