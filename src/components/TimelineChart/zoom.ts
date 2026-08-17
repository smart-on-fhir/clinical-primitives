/** Tightest and widest the visible range may get: one minute, and a century. */
const MIN_VISIBLE_RANGE = 1000 * 60;
const MAX_VISIBLE_RANGE = 1000 * 60 * 60 * 24 * 365 * 100;

/**
 * A visible range scaled about a point in it, held within the chart's limits.
 *
 * `factor` multiplies the span: above 1 widens, below 1 tightens. `ratio` is the
 * fraction across the plot that stays put — the toolbar's buttons anchor on the
 * middle, which is where a reader with no pointer on the plot is looking.
 *
 * The one place the limits live, so every way of zooming agrees about how far it
 * may go. A second copy is a second chance for two controls to stop in different
 * places, which reads as one of them being broken.
 *
 * Null where there is nothing to scale — a range of no width, or a factor that
 * would invert it.
 */
export function zoomedRange(
    visibleRangeStart: number,
    visibleRangeEnd: number,
    factor: number,
    ratio: number = 0.5
): [number, number] | null {
    const visibleRange = visibleRangeEnd - visibleRangeStart;

    if (!(visibleRange > 0) || !(factor > 0)) {
        return null;
    }

    const nextRange = Math.min(MAX_VISIBLE_RANGE, Math.max(MIN_VISIBLE_RANGE, visibleRange * factor));

    // Hold the anchored instant still: it keeps the same fractional position
    // across the plot before and after the zoom.
    const anchor    = visibleRangeStart + visibleRange * ratio;
    const nextStart = anchor - nextRange * ratio;

    return [nextStart, nextStart + nextRange];
}
