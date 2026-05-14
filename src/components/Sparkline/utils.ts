import { Observation } from "fhir/r4";
import { extractObservationNumericValue, getObservationDate } from "../Observation/utils";

export type SparklineSeries = {
    /** Short display label, e.g. "Sys" or "Dia". Empty string for single-series. */
    label?: string;
    points: string;
    /** CSS variable name for the stroke color, e.g. 'var(--data-red)'. */
    color?: string;
    /** Stroke opacity 0–1. Lower for the secondary series. */
    opacity?: number;
    /** Coordinate-space position of the highlighted observation (same space as the points string). */
    dot?: { x: number; y: number; r?: number } | null;
    /**
     * Lab reference range, in the same coordinate space as the points string.
     * • [low, high] — colors the line green/orange/red via a vertical gradient.
     * • number      — renders a single dashed reference line; no color gradient.
     */
    range?: [number, number] | number;
    /** Stroke width in pixels. Default 2. */
    lineWidth?: number;
};

export const defaultSparklineColors = [
    'var(--cp-color-blue)',
    'var(--cp-color-purple)',
    'var(--cp-color-green)',
    'var(--cp-color-amber)',
    'var(--cp-color-teal)',
    'var(--cp-color-red)',
    'var(--cp-color-gray)',
    'var(--cp-color-yellow)',
];

/**
 * Converts a data value (e.g. a reference range bound) to the SVG y-coordinate
 * space used by computeMultiSparklines, so it can be passed as a yLines entry
 * to the Sparkline component. Returns null when no numeric observations exist.
 */
export function dataValueToSparkY(
    dataValue: number,
    observations: Observation[],
    height = 24,
): number | null {
    const values = observations
        .map(o => extractObservationNumericValue(o))
        .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range  = maxVal - minVal || 1;
    const pad    = 2;
    return ((dataValue - minVal) / range) * (height - pad * 2);
}

/**
 * Extracts one sparkline series per component for component-based observations
 * (e.g. blood pressure → systolic + diastolic), or a single series for scalar
 * observations. All series share the same y-scale so lines are comparable.
 *
 * Returns an empty array when there is no plottable data.
 */
export function computeMultiSparklines(
    observations: Observation[],
    {
        sparkColor = defaultSparklineColors[0],
        width = 80,
        height = 24,
        highlightObs = null,
        maxPoints = 16,
        observation = null,
        lineWidth = 2
    }: {
        sparkColor?: string,
        width?: number,
        height?: number,
        highlightObs?: Observation | null
        maxPoints?: number,
        observation?: Observation | null,
        lineWidth?: number,
    }
): SparklineSeries[] {
    const pad = 2;

    if (!highlightObs && observation) {
        highlightObs = observations.find(o =>
            o === observation || (o.id && o.id === observation.id)
        ) ?? null;
    }

    const sorted = [...observations]
        .map(obs => ({ date: getObservationDate(obs), obs }))
        .filter(({ date }) => date !== null)
        .sort((a, b) => a.date!.getTime() - b.date!.getTime())
        .slice(-maxPoints);

    if (sorted.length === 0) return [];

    // Match by reference or FHIR id first (unambiguous), then fall back to
    // nearest date so callers that don't have the exact object still work.
    let highlightIdx: number | null = null;
    if (highlightObs) {
        const byIdentity = sorted.findIndex(({ obs }) =>
            obs === highlightObs || (obs.id && obs.id === highlightObs.id)
        );
        if (byIdentity !== -1) {
            highlightIdx = byIdentity;
        } else {
            const ht = getObservationDate(highlightObs)?.getTime();
            if (ht !== undefined) {
                let minDist = Infinity;
                sorted.forEach(({ date }, i) => {
                    const dist = Math.abs(date!.getTime() - ht);
                    if (dist < minDist) { minDist = dist; highlightIdx = i; }
                });
            }
        }

        // Tie-break: if the highlight date equals the last entry's date, the
        // ascending re-sort may have placed a duplicate-timestamp sibling last.
        // Force the dot to the final position so it always renders at the line end.
        if (highlightIdx !== null && highlightIdx < sorted.length - 1) {
            const hDate = getObservationDate(highlightObs)?.getTime() ?? -1;
            const lastDate = sorted[sorted.length - 1].date!.getTime();
            if (hDate === lastDate) highlightIdx = sorted.length - 1;
        }
    }

    // --- Detect component-based observations ---
    const componentKeys: string[] = [];
    const componentSeries = new Map<string, (number | null)[]>();

    for (const { obs } of sorted) {
        if (!obs.component?.length) continue;
        for (const comp of obs.component) {
            const coding = comp.code?.coding?.[0];
            const key = coding?.code ?? comp.code?.text ?? '';
            if (!key) continue;
            if (!componentSeries.has(key)) {
                componentKeys.push(key);
                componentSeries.set(key, []);
            }
        }
        break;
    }

    if (componentKeys.length >= 2) {
        for (const { obs } of sorted) {
            for (const key of componentKeys) {
                const comp = obs.component?.find(c => {
                    const k = c.code?.coding?.[0]?.code ?? c.code?.text ?? '';
                    return k === key;
                });
                const v = comp?.valueQuantity?.value;
                componentSeries.get(key)!.push(v !== undefined ? Number(v) : null);
            }
        }

        const allValues = [...componentSeries.values()]
            .flat()
            .filter((v): v is number => v !== null);
        if (allValues.length === 0) return [];

        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const range  = maxVal - minVal || 1;

        function toPoints(values: (number | null)[]): string {
            const valid = values.map((v, i) => v !== null ? { i, v } : null).filter(Boolean) as { i: number; v: number }[];
            if (valid.length < 2) return '';
            const n = values.length - 1 || 1;
            return valid.map(({ i, v }) => {
                const x = (i / n) * width;
                // const y = height - pad - ((v - minVal) / range) * (height - pad * 2);
                const y = ((v - minVal) / range) * (height - pad * 2);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
        }

        const toCompY = (v: number) => ((v - minVal) / range) * (height - pad * 2);

        const result: SparklineSeries[] = [];
        componentKeys.forEach((key, idx) => {
            const matchComp = (c: { code?: { coding?: { code?: string }[]; text?: string } }) =>
                (c.code?.coding?.[0]?.code ?? c.code?.text ?? '') === key;

            const comp = sorted.find(({ obs }) => obs.component?.some(matchComp))
                ?.obs.component?.find(matchComp);
            const display = comp?.code?.coding?.[0]?.display ?? comp?.code?.text ?? key;
            const label = display.replace(/\s*(blood pressure|pressure)\s*/i, '').slice(0, 3);
            const pts = toPoints(componentSeries.get(key)!);

            let dot: SparklineSeries['dot'] | null = null;
            if (pts && highlightIdx !== null) {
                const vals = componentSeries.get(key)!;
                const v = vals[highlightIdx];
                if (v !== null) {
                    const n = vals.length - 1 || 1;
                    const x = (highlightIdx / n) * width;
                    dot = { x, y: toCompY(v), r: lineWidth * 2.5 };
                }
            }

            let seriesRange: SparklineSeries['range'] | undefined;
            for (const { obs } of sorted) {
                const c = obs.component?.find(matchComp);
                const rr = c?.referenceRange?.[0];
                if (!rr) continue;
                const lo = rr.low?.value, hi = rr.high?.value;
                if (lo !== undefined && hi !== undefined) { seriesRange = [toCompY(lo), toCompY(hi)]; break; }
                if (lo !== undefined) { seriesRange = toCompY(lo); break; }
                if (hi !== undefined) { seriesRange = toCompY(hi); break; }
            }

            if (pts) {
                result.push({
                    label,
                    points: pts,
                    color: defaultSparklineColors[idx % defaultSparklineColors.length],
                    opacity: 1,
                    dot,
                    range: seriesRange,
                    lineWidth
                });
            }
        });

        if (result.length >= 2) return result;
    }

    // --- Single scalar series ---
    // Keep track of original sorted indices so we can locate the highlight.
    const indexedValues = sorted
        .map(({ obs }, i) => ({ i, v: extractObservationNumericValue(obs) }))
        .filter((iv): iv is { i: number; v: number } => iv.v !== null);

    if (indexedValues.length === 0) return [];
    const values = indexedValues.map(iv => iv.v);

    if (values.length === 1) {
        const dot = highlightIdx !== null ? { x: 0, y: height / 2, r: lineWidth * 2.5 } : null;
        return [{
            label: '',
            points: `0,${height / 2} ${width},${height / 2}`,
            color: sparkColor,
            opacity: 1,
            dot,
            lineWidth
        }];
    }

    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range  = maxVal - minVal || 1;

    const pts = indexedValues.map(({ v }, i) => {
        const x = (i / (indexedValues.length - 1)) * width;
        const y = ((v - minVal) / range) * (height - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const toScalarY = (v: number) => ((v - minVal) / range) * (height - pad * 2);

    let dot: { x: number; y: number; r: number } | null = null;
    if (highlightIdx !== null) {
        const hitInIndexed = indexedValues.findIndex(({ i }) => i === highlightIdx);
        if (hitInIndexed !== -1) {
            const x = (hitInIndexed / (indexedValues.length - 1)) * width;
            dot = { x, y: toScalarY(indexedValues[hitInIndexed].v), r: lineWidth * 2.5 };
        }
    }

    let seriesRange: SparklineSeries['range'] | undefined;
    for (const { obs } of sorted) {
        const rr = obs.referenceRange?.[0];
        if (!rr) continue;
        const lo = rr.low?.value, hi = rr.high?.value;
        if (lo !== undefined && hi !== undefined) { seriesRange = [toScalarY(lo), toScalarY(hi)]; break; }
        if (lo !== undefined) { seriesRange = toScalarY(lo); break; }
        if (hi !== undefined) { seriesRange = toScalarY(hi); break; }
    }

    return [{
        label: '',
        points: pts,
        color: sparkColor,
        opacity: 1,
        dot,
        range: seriesRange,
        lineWidth
    }];
}