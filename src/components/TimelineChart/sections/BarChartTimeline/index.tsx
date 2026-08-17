import { ReactNode, useId, useMemo } from "react";
import "./BarChartTimeline.scss";
import { TimelineChartHighlight, TimelineChartLayer, type TimelineChartLayerProps } from "../..";
import { useTimelineChartContext } from "../../TimelineChartContext";

/** One interval on a row. */
export type TimelineBar = {
    x1: number,
    x2: number,

    /**
     * Fill color, as any CSS color. The straightforward way to color a bar.
     *
     * Wins over {@link TimelineBar.className} when both are given. Note that a
     * literal color does not follow the light/dark theme the way the library's
     * fill classes do, so pick one that works on both — or use a class.
     */
    color?: string,

    /**
     * Fill by CSS class instead, for cases a plain color cannot express:
     * theme-aware library colors (`cp-fill-blue`), opacity modifiers, patterns
     * for a hatched or dashed bar.
     *
     * `cp-timeline-bar-muted` is provided for the common one: an interval that
     * is over rather than current, drawn back so it stays the same thing as the
     * live bars beside it. It combines with a fill class, and lifts again while
     * the bar is selected.
     */
    className?: string,

    /**
     * Distinguishes this bar from any other covering the same dates. Defaults to
     * the bar's position, which is enough to stop two identical intervals from
     * being selected together — pass something stable, like a resource id, if
     * the selection should survive the data being reordered.
     */
    id?: string,

    /**
     * Tooltip shown while the bar is hovered, as Markdown. Requires a
     * `<Tooltip />` to be mounted somewhere in the app.
     *
     * Deliberately a plain string rather than a node: it stays domain-agnostic,
     * and a bar is small enough that hovering it should explain the interval,
     * not reproduce the detail panel. Build it with `escapeTooltipMarkdown` for
     * any value that came from data.
     */
    tooltip?: string,

    /**
     * Called when this bar is clicked, after the interval has been selected.
     * Sections use it to show a detail view for whatever the bar stands for.
     */
    onSelect?: () => void
};

/**
 * One labelled row, holding every interval that belongs to the same thing — a
 * drug taken in three separate courses is one row with three bars, not three
 * rows sharing a name.
 */
export type TimelineBarRow = {
    label: ReactNode,
    bars: TimelineBar[]
};

/**
 * A section that renders labelled rows of horizontal bars, for data with a
 * duration — a medication course, an encounter, a condition's active period.
 *
 * Domain-agnostic by design: it knows about intervals, not about what they mean.
 * FHIR-aware sections live alongside it in `sections/` and use this to draw.
 */
export function BarChartTimeline({
    label,
    legend,
    rows,
    rowHeight = '1.6em',
    settings,
    narrative,
    selection,
    dataRangeStart,
    dataRangeEnd
}: {
    label: TimelineChartLayerProps['label'],
    legend?: TimelineChartLayerProps['legend'],
    settings?: TimelineChartLayerProps['settings'],
    narrative?: TimelineChartLayerProps['narrative'],
    selection?: TimelineChartLayerProps['selection'],
    rowHeight?: number | string,

    /**
     * The section's extent, when the rows on screen are not the whole of it.
     *
     * Defaults to the span of `rows`, which is right for a section that draws
     * everything it has. A section that lets the user hide rows should pass the
     * span of all of them instead: the chart adds these up to decide what
     * "everything on record" means, and a hidden row is still on record —
     * without this, unchecking one would quietly redefine the chart's full
     * range for every other section too.
     */
    dataRangeStart?: number,
    dataRangeEnd?: number,

    rows: TimelineBarRow[]
}) {
    // Only feeds the fallback extent below, and the rows it walks do not change
    // while the chart is panned — so it is held rather than rebuilt per frame.
    const allBars = useMemo(() => rows.flatMap(row => row.bars), [rows]);

    // Bar ids only have to be unique within a section, but the selection is
    // chart-wide, so they are namespaced to this instance.
    const instanceId = useId();

    // Row hover — marking a label and its bars together — is the layer's job,
    // since it is the component that renders both columns. Nothing to do here.

    return (
        <TimelineChartLayer
            label={label}
            legend={legend}
            // `span 0` is not valid CSS, so an empty section still claims one row.
            rows={Math.max(1, rows.length)}
            rowHeight={rowHeight}
            settings={settings}
            narrative={narrative}
            selection={selection}
            dataRangeStart={dataRangeStart ?? (allBars.length ? Math.min(...allBars.map(b => b.x1)) : undefined)}
            dataRangeEnd={dataRangeEnd ?? (allBars.length ? Math.max(...allBars.map(b => b.x2)) : undefined)}
            labels={rows.map((row, index) => (
                <div key={index}>{row.label}</div>
            ))}
        >
            { rows.map((row, rowIndex) => (
                <BarRow
                    key={rowIndex}
                    bars={row.bars}
                    idPrefix={`${instanceId}:${rowIndex}`}
                />
            )) }
            <TimelineChartHighlight />
        </TimelineChartLayer>
    )
}

/**
 * Splits a row's bars into lanes so that no two bars in a lane overlap.
 *
 * Real data is dirty: the same drug is often prescribed several times with
 * overlapping validity periods, and drawing those in one lane paints them on top
 * of each other — unreadable, and impossible to click accurately. Stacking is
 * the honest alternative to hiding or merging them.
 *
 * A greedy first-fit over bars sorted by start, which is optimal for interval
 * graphs: it never uses more lanes than the maximum number of bars overlapping
 * at any instant. A row with no overlaps therefore stays exactly one lane.
 */
function packIntoLanes(bars: TimelineBar[]): TimelineBar[][] {
    const lanes: { end: number, bars: TimelineBar[] }[] = [];

    for (const bar of [...bars].sort((a, b) => a.x1 - b.x1)) {
        // A bar may start exactly where the previous one ended — consecutive
        // courses of the same drug do this constantly, and splitting them into
        // lanes would be noise. Zero-width bars are the exception: two instants
        // at the same moment genuinely coincide and must be stacked, or they
        // render as one mark.
        const lane = lanes.find(l => bar.x1 > l.end || (bar.x1 === l.end && bar.x1 !== bar.x2));

        if (lane) {
            lane.bars.push(bar);
            lane.end = Math.max(lane.end, bar.x2);
        } else {
            lanes.push({ end: bar.x2, bars: [bar] });
        }
    }

    return lanes.map(lane => lane.bars);
}

/** One row, its bars stacked into as many lanes as their overlaps require. */
function BarRow({ bars, idPrefix, className = "", ...rest }: {
    bars: TimelineBar[],
    idPrefix: string,
    className?: string
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className">) {
    // Two sorts and a packing pass, all over absolute times — none of it moves
    // when the visible range does. Held across pans and zooms, which is what
    // keeps a drag from re-packing every row on every pointer move. Depends on
    // the caller handing back a stable `bars` array; the sections in this
    // library build theirs inside a `useMemo` for exactly that reason.
    const lanes = useMemo(() => {
        // Ids are assigned before packing, so the positional fallback refers to
        // a bar's place in the caller's data rather than wherever packing put it.
        const identified = bars.map((bar, index) => ({
            ...bar,
            id: bar.id ?? `${idPrefix}:${index}`,
            zIndex: 1
        }));

        // Shortest bars sit on top. Lane packing keeps bars from overlapping in
        // time, but they can still overlap on screen: `min-width` stretches a
        // bar past its true end when zoomed out, and an instant is nudged left
        // of its moment. Whichever bar is shorter has less of itself to lose,
        // so it wins.
        [...identified]
            .sort((a, b) => (b.x2 - b.x1) - (a.x2 - a.x1))
            // Offset so the lowest rank still clears the stylesheet's base
            // z-index for bars, keeping them above the row's hover background.
            .forEach((bar, rank) => { bar.zIndex = rank + 2; });

        return packIntoLanes(identified);
    }, [bars, idPrefix]);

    return (
        <div className={`cp-timeline-bar-row ${className}`} {...rest}>
            { lanes.map((lane, laneIndex) => (
                <div className="cp-timeline-bar-lane" key={laneIndex}>
                    { lane.map(bar => <Bar key={bar.id} {...bar} />) }
                </div>
            )) }
        </div>
    );
}

function Bar({ x1, x2, color, className = "", id, zIndex, tooltip, onSelect }: TimelineBar & { zIndex?: number }) {
    const { setHighlightRange, toPercent, selectedId } = useTimelineChartContext();

    // Matched by identity, not by interval: two medications can cover exactly
    // the same dates, and comparing dates would select both at once. Still
    // derived rather than stored, so a selection made elsewhere deselects this
    // bar without anyone having to coordinate.
    const selected = id !== undefined && id === selectedId;

    // Unclamped on purpose — a bar that starts before or ends after the visible
    // range overflows its row and gets clipped by it, which squares off the
    // rounded cap and shows that the bar continues off-screen.
    const leftPercent  = toPercent(x1);
    const widthPercent = toPercent(x2) - leftPercent;

    // An interval with no duration is a point in time, not a span, and needs its
    // own treatment to stay visible and hittable.
    const instant = x1 === x2;

    return (
        <div
            className={[
                "cp-timeline-bar",
                instant && "cp-timeline-bar-instant",
                selected && "cp-timeline-bar-selected",
                className
            ].filter(Boolean).join(" ")}
            data-tooltip={tooltip}
            // A bar can span most of the chart, so its own center is a poor
            // anchor — it can sit far from where the user is actually pointing,
            // or off-screen entirely. Tracking the cursor horizontally puts the
            // tooltip at the date being pointed at; vertically it stays above
            // the bar, clear of the cursor.
            data-tooltip-x={tooltip ? "pointer" : undefined}
            onClick={event => {
                // Without this the click carries on to the content area, which
                // treats a click on nothing as "clear the selection" — and would
                // undo the selection just made.
                event.stopPropagation();
                setHighlightRange(x1, x2, id);
                onSelect?.();
            }}
            // An inline background beats the class's, which is what makes `color`
            // take precedence when both are supplied.
            style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, backgroundColor: color, zIndex }}
        />
    );
}
