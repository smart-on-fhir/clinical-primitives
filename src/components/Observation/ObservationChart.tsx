import { useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Observation } from "fhir/r4";
import { splinePath, type Point } from "./spline";
import { escapeTooltipMarkdown } from "../Tooltip";
import { cleanUnit } from "./utils";
import {
    boundRuns,
    rangeGradientStops,
    readInterpretation,
    resolveRange,
    rangeZones,
    statusFor,
    type RangeStatus,
    type RangeTone,
    type ReferenceRangeResolver,
    type ResolvedRange
} from "./referenceRange";
import "./ObservationChart.scss";

/**
 * Cycled across series. Theme-aware, unlike literal colors.
 *
 * Red and amber are absent from the palette entirely. Each means one specific
 * thing on this chart — outside the interval, and on the edge of it — and a
 * series that merely happened to fall third in the list would claim that
 * meaning without having earned it.
 *
 * Every entry must be visibly distinct from its neighbors: these separate one
 * series from another, and the multi-component observations that reach two or
 * more of them (blood pressure being the obvious one) are exactly the charts
 * where telling the lines apart is the whole point.
 */
const SERIES_COLORS = [
    "var(--cp-color-blue)",
    "var(--cp-color-green)",
    "var(--cp-color-purple)",
    "var(--cp-color-teal)"
];

const PADDING = { top: 10, right: 12, bottom: 22, left: 46 };

/** Identifies the reading nearest the cursor: which series, and which point. */
interface HoveredPoint {
    series: number,
    index : number
}

/** One line on the chart. */
export interface ObservationChartSeries {
    /**
     * Code of the component to plot, for observations that carry their values
     * in `component` rather than directly — blood pressure being the standard
     * case. Omit to plot the observation's own `valueQuantity`.
     */
    code?: string,

    /** Defaults to the component's own display name, or the observation's. */
    label?: string,

    /** Any CSS color. Defaults to the next entry in the palette. */
    color?: string
}

/** A plotted reading, with whatever is known about where it should have fallen. */
interface ResolvedPoint {
    x     : number,
    y     : number,
    obs   : Observation,

    /** Bounds applying to this reading, or null when none could be resolved. */
    range : ResolvedRange | null,

    /**
     * Where the reading fell. Null when nothing said — no bounds and no
     * interpretation — which is a different claim from `"normal"` and is drawn
     * differently for it.
     */
    status: RangeStatus | null
}

interface ResolvedSeries {
    key   : string,
    label : string,
    color : string,
    unit  : string | null,
    points: ResolvedPoint[]
}

function matchesCode(obs: Observation, code: string): boolean {
    return (obs.code?.coding ?? []).some(coding => coding.code === code);
}

function observationTime(obs: Observation): number | null {
    const raw = obs.effectiveDateTime || obs.issued;
    if (!raw) return null;
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? null : time;
}

/**
 * Read one series' value out of an observation, as a number and its unit.
 * Only `valueQuantity` is trusted: it is the one FHIR type that is
 * unambiguously numeric, and parsing a display string would turn values like
 * "2+ protein" into plausible-looking data points.
 */
function readValue(obs: Observation, spec: ObservationChartSeries) {
    const quantity = spec.code
        ? (obs.component ?? []).find(component =>
            (component.code?.coding ?? []).some(coding => coding.code === spec.code)
          )?.valueQuantity
        : obs.valueQuantity;

    if (quantity?.value === undefined) {
        return null;
    }

    const value = Number(quantity.value);

    return Number.isFinite(value)
        ? { value, unit: quantity.unit ? cleanUnit(quantity.unit) : null }
        : null;
}

/**
 * Work out what to plot when the caller did not say.
 *
 * An observation carrying its own `valueQuantity` is one line. One that keeps
 * its values in `component` — blood pressure, most obviously — becomes one line
 * per distinct component, so a caller does not have to know in advance that a
 * code happens to be multi-valued.
 */
function inferSeries(observations: Observation[]): ObservationChartSeries[] {
    if (observations.some(obs => obs.valueQuantity?.value !== undefined)) {
        return [{}];
    }

    const found = new Map<string, string>();

    for (const obs of observations) {
        for (const component of obs.component ?? []) {
            if (component.valueQuantity?.value === undefined) continue;

            const coding = (component.code?.coding ?? [])[0];
            const code   = coding?.code;

            if (code && !found.has(code)) {
                found.set(code, component.code?.text ?? coding?.display ?? code);
            }
        }
    }

    return [...found].map(([code, label]) => ({ code, label }));
}

/** Tick values at 1/2/5 × 10ⁿ steps, so labels read as round numbers. */
function niceTicks(min: number, max: number, count = 4): number[] {
    if (!(max > min)) {
        return [min];
    }

    const rawStep  = (max - min) / count;
    const exponent = Math.floor(Math.log10(rawStep));
    const base     = Math.pow(10, exponent);
    const step     = [1, 2, 5, 10].map(m => m * base).find(s => s >= rawStep) ?? 10 * base;

    const ticks: number[] = [];

    for (let tick = Math.ceil(min / step) * step; tick <= max + step / 1000; tick += step) {
        ticks.push(Number(tick.toFixed(10)));
    }

    return ticks;
}

/**
 * Round a measured value to something readable. Exported so callers labelling
 * the same numbers elsewhere — a row header, a legend — format them the way the
 * axis does instead of printing raw floating point.
 */
export function formatTick(value: number): string {
    if (Math.abs(value) >= 1000) return value.toLocaleString();
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(Math.abs(value) < 1 ? 2 : 1);
}

/** How an interval reads in a tooltip: one-sided intervals quote only their bound. */
function formatRange({ low, high }: { low?: number, high?: number }): string {
    if (low !== undefined && high !== undefined) return `${formatTick(low)}–${formatTick(high)}`;
    if (high !== undefined) return `≤ ${formatTick(high)}`;
    if (low  !== undefined) return `≥ ${formatTick(low)}`;
    return "";
}

/**
 * A line chart of one observation's numeric values over time.
 *
 * Selects observations by code, then draws one smoothed line per series. The
 * curve is monotone cubic rather than a plain spline, so it can never bulge
 * past a reading and suggest a value the patient never had — see
 * {@link splinePath}.
 */
export function ObservationChart({
    observations,
    code,
    series,
    label,
    height = 180,
    mapX,
    crosshair = false,
    minMaxLabels,
    referenceRange,
    abnormalColor = "hsl(340deg, 70%, 55%)",
    warningColor = "hsl(280deg, 70%, 50%)",
    className
}: {
    observations: Observation[],

    /** Code selecting which observations to plot — LOINC, typically. */
    code: string,

    /**
     * Lines to draw. Omit to infer them: the observation's own value, or one
     * line per component for multi-valued observations like blood pressure.
     */
    series?: ObservationChartSeries[],

    /** Chart heading. Defaults to the observations' own display name. */
    label?: string,

    /** Plot height in pixels. Width always fills the container. */
    height?: number,

    /**
     * Share an outer chart's horizontal scale instead of deriving one from this
     * chart's own data, as a fraction (0–1) of the plot width. Required when
     * stacking charts inside a TimelineChart: the layers only line up if every
     * one of them positions through the same scale.
     *
     * Supplying it switches the chart to an embedded form — no header, no axis
     * labels, no horizontal padding — because the surrounding chart owns all of
     * those, and any left gutter here would shift this layer out of alignment
     * with the ones above it.
     */
    mapX?: (time: number) => number,

    /**
     * Draw a vertical rule through the hovered reading. Off by default: when
     * several charts are stacked under a shared axis, the surrounding chart
     * supplies one rule across all of them, and a per-chart rule would stack up
     * as a column of disconnected segments.
     */
    crosshair?: boolean,

    /**
     * Label the lowest and highest readings on the y axis, at the positions
     * those values occupy.
     *
     * Defaults on for an embedded chart and off otherwise: an embedded chart has
     * no tick labels at all, so without these its vertical scale is unreadable,
     * while a standalone one already has a full axis and would only be repeating
     * itself.
     */
    minMaxLabels?: boolean,

    /**
     * Supplies reference bounds for readings that do not carry their own.
     *
     * Bounds found on the observation are always preferred and need no prop —
     * they came from the laboratory that ran the specimen. This is the fallback
     * for the common case of a record that reports values and nothing else.
     *
     * Omitting it does not disable out-of-range coloring; it only means that
     * records without their own `referenceRange` go uncolored.
     */
    referenceRange?: ReferenceRangeResolver,

    /**
     * Color for stretches of the curve outside the reference interval. Applies
     * to every series, deliberately: it marks a clinical fact rather than
     * identifying a line, so varying it per series would read as a third set of
     * series colors.
     */
    abnormalColor?: string,

    /**
     * Color for readings just past a limit, before they reach
     * {@link saturationValue} and take the abnormal color. This is the color the
     * limit itself is drawn in.
     */
    warningColor?: string,

    className?: string
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    // Measured rather than left to the viewBox: stretching a viewBox scales the
    // stroke and text with it, so a wide chart would get fat lines.
    useLayoutEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        setWidth(element.getBoundingClientRect().width);

        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const matching = observations
        .filter(obs => matchesCode(obs, code))
        .map(obs => ({ obs, time: observationTime(obs) }))
        .filter((entry): entry is { obs: Observation, time: number } => entry.time !== null)
        .sort((a, b) => a.time - b.time);

    const specs = series ?? inferSeries(matching.map(entry => entry.obs));

    const resolved: ResolvedSeries[] = specs.map((spec, index) => {
        // Keyed by time so two readings at the same instant cannot produce a
        // zero-width segment; the later one wins, as it would in a table.
        const byTime = new Map<number, ResolvedPoint>();

        let unit: string | null = null;

        for (const { obs, time } of matching) {
            const reading = readValue(obs, spec);
            if (!reading) continue;

            unit ??= reading.unit;

            // Resolved per reading rather than once per series: the answer can
            // legitimately differ down the line, when a record spans an age band
            // or a laboratory revises its interval. The reading's own unit is
            // what a table must match, not the series unit, which is merely the
            // first one seen.
            const range = resolveRange(obs, spec.code, reading.unit, time, referenceRange);

            // The laboratory's own verdict outranks our arithmetic where it gave
            // one; the comparison is what fills in the far more common case of a
            // range with no interpretation beside it.
            const status = readInterpretation(obs, spec.code)
                ?? (range ? statusFor(reading.value, range) : null);

            byTime.set(time, { x: time, y: reading.value, obs, range, status });
        }

        const first = matching[0]?.obs;

        return {
            key   : spec.code ?? "value",
            // `label` before the record's own display name: a caller naming the
            // chart has named this series too, since a chart plotting an
            // observation's own value has only the one. Without it the tooltip
            // falls through to the raw LOINC for any record that omits a display
            // name — "39803-2" where the row header says "Infliximab".
            label : spec.label
                    ?? (spec.code
                        ? spec.code
                        : label ?? first?.code?.text ?? first?.code?.coding?.[0]?.display ?? code),
            color : spec.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
            unit,
            points: [...byTime.values()].sort((a, b) => a.x - b.x)
        };
    }).filter(entry => entry.points.length > 0);

    const heading = label
        ?? matching[0]?.obs.code?.text
        ?? matching[0]?.obs.code?.coding?.[0]?.display
        ?? code;

    const unit = resolved.find(entry => entry.unit)?.unit ?? null;

    // The measured container is rendered unconditionally, including while there
    // is no data. It used to be skipped on the empty branch, which meant the
    // ResizeObserver found no node on mount, never attached, and — with no
    // dependencies to re-run on — left the width pinned at 0 once observations
    // finally arrived. Every chart then silently suppressed its own SVG.
    return (
        <div className={["cp-observation-chart", className].filter(Boolean).join(" ")} ref={containerRef}>
            { !mapX &&
            <div className="cp-observation-chart-header">
                <span className="cp-observation-chart-title">
                    {heading}
                    {unit && <span className="cp-observation-chart-unit"> ({unit})</span>}
                </span>

                { resolved.length > 1 &&
                    <span className="cp-observation-chart-legend">
                        { resolved.map(entry => (
                            <span key={entry.key} className="cp-observation-chart-legend-item">
                                <span
                                    className="cp-observation-chart-swatch"
                                    style={{ backgroundColor: entry.color }}
                                />
                                {entry.label}
                            </span>
                        )) }
                    </span> }
            </div> }

            { resolved.length === 0
                // Names the code that found nothing, so an empty chart reads as
                // "not in this record" rather than as a broken component.
                ? <p className="cp-observation-chart-empty">
                      No numeric observations for code <code>{code}</code>.
                  </p>
                // Held back until measured: at width 0 every point collapses
                // onto one coordinate and the first paint would show a spike.
                : width > 0 &&
                    <ObservationPlot
                        resolved={resolved}
                        width={width}
                        height={height}
                        heading={heading}
                        mapX={mapX}
                        crosshair={crosshair}
                        minMaxLabels={minMaxLabels ?? Boolean(mapX)}
                        abnormalColor={abnormalColor}
                        warningColor={warningColor}
                    /> }
        </div>
    );
}

/**
 * The plot itself, given resolved series and a known pixel size.
 *
 * Split out so the measured container above can mount unconditionally: the
 * scales are only definable once there is both data and a width, and mixing
 * that into the outer component is what let the observer go unattached.
 */
function ObservationPlot({ resolved, width, height, heading, mapX, crosshair, minMaxLabels, abnormalColor, warningColor }: {
    resolved     : ResolvedSeries[],
    width        : number,
    height       : number,
    heading      : string,
    mapX        ?: (time: number) => number,
    crosshair    : boolean,
    minMaxLabels : boolean,
    abnormalColor: string,
    warningColor : string
}) {
    const [hovered, setHovered] = useState<HoveredPoint | null>(null);

    // Scopes the clip paths to this chart. Several charts stack in one document
    // and `clip-path: url(#id)` resolves document-wide, so a shared id would
    // have every row clipped to whichever chart rendered last.
    // Stripped to characters safe in a fragment reference: React 19's ids are
    // wrapped in guillemets, which `url(#…)` cannot be relied on to parse.
    const clipPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");

    const allPoints = resolved.flatMap(entry => entry.points);
    const minX      = Math.min(...allPoints.map(p => p.x));
    const maxX      = Math.max(...allPoints.map(p => p.x));
    const rawMinY   = Math.min(...allPoints.map(p => p.y));
    const rawMaxY   = Math.max(...allPoints.map(p => p.y));

    // A series that never moves still needs a band to sit in, or it would be
    // drawn against a zero-height scale.
    const spread = rawMaxY - rawMinY || Math.abs(rawMaxY) * 0.1 || 1;
    const minY   = rawMinY - spread * 0.1;
    const maxY   = rawMaxY + spread * 0.1;

    // An external scale must reach the container's own edges, so the horizontal
    // gutters go away entirely; keeping them would shift this layer relative to
    // every other one sharing the axis. The vertical gutters only shrink, since
    // they cost nothing in alignment but a taller row would waste space.
    const padding = mapX
        ? { top: 4, right: 0, bottom: 4, left: 0 }
        : PADDING;

    const plotWidth  = Math.max(0, width - padding.left - padding.right);
    const plotHeight = Math.max(0, height - padding.top - padding.bottom);

    const scaleX = mapX
        ? (x: number) => mapX(x) * width
        : (x: number) => padding.left + (maxX === minX ? plotWidth / 2 : ((x - minX) / (maxX - minX)) * plotWidth);

    const scaleY = (y: number) => padding.top + (1 - (y - minY) / (maxY - minY)) * plotHeight;

    // Axis furniture belongs to the outer chart when it owns the scale.
    const ticks = mapX ? [] : niceTicks(minY, maxY);

    // Screen coordinates for every series, computed once: the nearest-point
    // search needs all of them together, and drawing reuses the same values.
    const plotted = resolved.map((entry, seriesIndex) => {
        const scaled = entry.points.map(p => ({ x: scaleX(p.x), y: scaleY(p.y) }));

        // Clipped against the full height rather than the padded plot area: the
        // regions describe "beyond the limit", and the gutters are not part of
        // that question. A bound lying outside the visible scale simply produces
        // a region off the top or bottom, which covers nothing — which is the
        // correct outcome for a limit no reading came near.
        // Every color boundary the interval implies, projected onto the plot.
        // Derived from `rangeZones` rather than computed here so the line and
        // the marks can never end up reading the interval differently.
        const bounded = entry.points.map((point, index) => {
            const zones = point.range ? rangeZones(point.range) : {};
            const y     = (value?: number) => value === undefined ? undefined : scaleY(value);

            return {
                x         : scaled[index].x,
                highRedY  : y(zones.highRed),
                highY     : y(zones.high),
                highGreenY: y(zones.highGreen),
                lowGreenY : y(zones.lowGreen),
                lowY      : y(zones.low),
                lowRedY   : y(zones.lowRed)
            };
        });

        // Stretched well past the plot on both sides. The runs are only there to
        // separate one interval from the next, and an embedded chart that has
        // been panned holds readings outside its own box — clipping a run at the
        // box edge would cut the curve short of where it actually goes.
        const overhang = Math.max(width, 1) * 2;

        // The gradient is resolved here rather than while rendering because the
        // marks need it too: a dot painted with the same paint server as the
        // line is guaranteed to match the line beneath it, at any height, for
        // free. Deriving a color for the dot separately meant two computations
        // that could disagree — and did, visibly, near a boundary.
        const runs = boundRuns(
            bounded,
            Math.min(0, ...bounded.map(point => point.x)) - overhang,
            Math.max(width, ...bounded.map(point => point.x)) + overhang
        ).map((run, runIndex) => ({
            ...run,
            gradient  : rangeGradientStops(run, padding.top, height - padding.bottom),
            gradientId: `${clipPrefix}-grad-${seriesIndex}-${runIndex}`,
            clipId    : `${clipPrefix}-run-${seriesIndex}-${runIndex}`
        }));

        return { entry, scaled, runs };
    });

    /**
     * The paint the line is drawn with at a given horizontal position — a
     * gradient where the interval reaches the visible scale, the series color
     * where it does not.
     *
     * Marks use this so they are filled by the same paint server that strokes
     * the line. Because the gradient is vertical and in user space, a dot placed
     * over the line takes exactly the color the line has at that height, with no
     * second opinion about which tone applies.
     */
    const paintAt = (series: typeof plotted[number], x: number): string => {
        const run = series.runs.find(candidate => x >= candidate.from && x <= candidate.to);
        return run?.gradient ? `url(#${run.gradientId})` : series.entry.color;
    };

    /**
     * Track the reading nearest the cursor, in both axes.
     *
     * Hit-testing individual markers cannot give this: it only fires when the
     * pointer is actually over one, so between readings nothing is highlighted
     * and dense series need the targets shrunk until they are unusable. A
     * search over the coordinates always has an answer, so exactly one marker
     * is shown for as long as the pointer is anywhere on the chart.
     */
    const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const px   = event.clientX - rect.left;
        const py   = event.clientY - rect.top;

        let best: HoveredPoint | null = null;
        let bestDistance = Infinity;

        plotted.forEach((series, seriesIndex) => {
            series.scaled.forEach((point, index) => {
                // Squared distance: the ordering is the same and it avoids a
                // square root per point on every pointer move.
                const distance = (point.x - px) ** 2 + (point.y - py) ** 2;

                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = { series: seriesIndex, index };
                }
            });
        });

        // Re-rendering on every move would be wasteful when the answer has not
        // changed, which is most moves.
        setHovered(current =>
            current && best && current.series === best.series && current.index === best.index
                ? current
                : best
        );
    };

    const hoveredSeries = hovered ? plotted[hovered.series] : null;
    const hoveredPoint  = hoveredSeries?.entry.points[hovered!.index] ?? null;
    const hoveredCoords = hoveredSeries?.scaled[hovered!.index] ?? null;

    /**
     * The chart's only reading, where it has exactly one.
     *
     * Such a chart can describe itself before the pointer has arrived, because
     * there is nothing to choose between — whatever the nearest reading is, it
     * is this one. That matters for more than tidiness: the tooltip opens on
     * `pointerover`, and an element only counts if it already carries
     * `data-tooltip` when that fires. A chart that waits for the pointer to move
     * before setting the attribute has already missed the event.
     *
     * Every other chart gets a second `pointerover` for free — the pointer
     * crosses the stroked line, which is a hit-testable child, and the event
     * bubbles back to the SVG by which time the attribute is there. A lone
     * reading draws no line, and its dot is not hit-tested, so no second event
     * ever comes and the tooltip never opened at all.
     */
    const sole = resolved.length === 1 && resolved[0].points.length === 1
        ? plotted[0]
        : null;

    const shownSeries = hoveredSeries ?? sole;
    const shownPoint  = hoveredPoint  ?? sole?.entry.points[0] ?? null;

    // The SVG carries the tooltip because the marker sits wherever the nearest
    // reading is — usually not under the cursor, so it would never be hovered
    // itself. `data-tooltip-anchor` then points the bubble at the marker rather
    // than at the plot as a whole. The Tooltip component re-reads both this
    // attribute and the anchor's position while it is open.
    const tooltip = shownPoint && shownSeries
        ? [
            `**${escapeTooltipMarkdown(shownSeries.entry.label)}**`,
            `${escapeTooltipMarkdown(formatTick(shownPoint.y))}${shownSeries.entry.unit ? " " + escapeTooltipMarkdown(shownSeries.entry.unit) : ""}`,
            // Quoted only where there is one. A reading with no applicable
            // interval says nothing about itself rather than claiming to be
            // unremarkable, and the flag is stated in words as well as color so
            // the chart does not rely on hue alone to carry it.
            ...(shownPoint.range
                ? [`${shownPoint.status === "high" ? "**High** — " : shownPoint.status === "low" ? "**Low** — " : ""}ref ${escapeTooltipMarkdown(formatRange(shownPoint.range))}`]
                : shownPoint.status === "high" ? ["**High**"]
                : shownPoint.status === "low"  ? ["**Low**"]
                : []),
            escapeTooltipMarkdown(new Date(shownPoint.x).toLocaleDateString())
          ].join("\n")
        : undefined;

    return (
        <svg
            className={`cp-observation-chart-svg${mapX ? " cp-observation-chart-svg--embedded" : ""}`}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${heading} over time`}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHovered(null)}
            data-tooltip={tooltip}
            // The lone dot is drawn whether or not the pointer is present, so a
            // one-reading chart anchors to it rather than to the hover marker,
            // which may not exist yet. Anchoring to a missing element is worse
            // than it sounds: the resolver falls back to a document-wide search,
            // which would find some other row's marker.
            data-tooltip-anchor={sole ? ".cp-observation-chart-lone-point" : ".cp-observation-chart-marker"}
            // Opens as soon as the pointer is on the chart; a delay would make
            // the marker and its label disagree about what is happening.
            data-tooltip-delay="0"
        >
            { ticks.map(tick => (
                <g key={tick}>
                    <line
                        className="cp-observation-chart-grid"
                        x1={padding.left}
                        x2={width - padding.right}
                        y1={scaleY(tick)}
                        y2={scaleY(tick)}
                    />
                    <text
                        className="cp-observation-chart-tick"
                        x={padding.left - 6}
                        y={scaleY(tick)}
                        textAnchor="end"
                        dominantBaseline="middle"
                    >
                        {formatTick(tick)}
                    </text>
                </g>
            )) }

            { !mapX &&
                <>
                    <text className="cp-observation-chart-tick" x={PADDING.left} y={height - 6} textAnchor="start">
                        {new Date(minX).toLocaleDateString()}
                    </text>
                    <text className="cp-observation-chart-tick" x={width - PADDING.right} y={height - 6} textAnchor="end">
                        {new Date(maxX).toLocaleDateString()}
                    </text>
                </> }

            { plotted.map(({ entry, scaled, runs }, seriesIndex) => {
                const d = splinePath(scaled);

                // Only worth clipping when there is more than one interval to
                // keep apart. The usual series has exactly one, or none.
                const split = runs.length > 1;

                return (
                    <g key={entry.key}>
                        { runs.map((run, runIndex) => {
                            const { gradient, gradientId, clipId } = run;

                            const toneColor = (tone: RangeTone) =>
                                tone === "abnormal"   ? abnormalColor :
                                tone === "borderline" ? warningColor  :
                                entry.color;

                            return (
                                <g key={runIndex}>
                                    {/* No gradient where the curve cannot leave
                                        its interval anywhere on this scale —
                                        which covers both a series with no
                                        reference data and the far more common
                                        one sitting comfortably inside it. Either
                                        way a gradient would be one flat hue. */}
                                    { gradient &&
                                        <linearGradient
                                            id={gradientId}
                                            gradientUnits="userSpaceOnUse"
                                            x1={0} y1={gradient.from} x2={0} y2={gradient.to}
                                        >
                                            { gradient.stops.map((stop, index) => (
                                                <stop
                                                    key={index}
                                                    offset={stop.offset}
                                                    stopColor={toneColor(stop.tone)}
                                                />
                                            )) }
                                        </linearGradient> }

                                    { split &&
                                        <clipPath id={clipId}>
                                            <rect
                                                x={run.from}
                                                y={0}
                                                width={Math.max(0, run.to - run.from)}
                                                height={height}
                                            />
                                        </clipPath> }

                                    <path
                                        className="cp-observation-chart-line"
                                        d={d}
                                        stroke={gradient ? `url(#${gradientId})` : entry.color}
                                        clipPath={split ? `url(#${clipId})` : undefined}
                                    />
                                </g>
                            );
                        }) }

                        {/* A single reading has no segment to draw — its path is a
                            lone moveto, which paints nothing — so the row would look
                            empty until someone happened to hover it. Drawn
                            permanently instead, since there is no trend to read and
                            the point itself is the whole content. With no segment
                            there is no stroke for the gradient to color either, so
                            its status has to be carried by the mark itself. */}
                        { scaled.length === 1 &&
                            <circle
                                className="cp-observation-chart-lone-point"
                                cx={scaled[0].x}
                                cy={scaled[0].y}
                                r={5}
                                fill={paintAt(plotted[seriesIndex], scaled[0].x)}
                            /> }
                    </g>
                );
            }) }

            {/* After the lines, not before: SVG paints in document order, so
                drawing these first put them underneath the data and the
                translucent backdrop had nothing to show through it. */}
            {/* Against the right edge, where an embedded chart's own left gutter
                is zero and the row's name already sits. Putting these on the
                left stacked two different scales in one place: the section's
                label column reading one thing and the plot's extremes another,
                a few pixels apart. */}
            { minMaxLabels &&
                <>
                    <text
                        className="cp-observation-chart-edge-label"
                        x={width - padding.right - 2}
                        y={scaleY(rawMaxY)}
                        textAnchor="end"
                        dominantBaseline="middle"
                    >
                        {formatTick(rawMaxY)}
                    </text>
                    <text
                        className="cp-observation-chart-edge-label"
                        x={width - padding.right - 2}
                        y={scaleY(rawMinY)}
                        textAnchor="end"
                        dominantBaseline="middle"
                    >
                        {formatTick(rawMinY)}
                    </text>
                </> }

            { hoveredCoords && hoveredSeries &&
                <>
                    {/* A full-height rule reads the date off the axis without
                        having to trace the curve down to it. */}
                    { crosshair &&
                        <line
                            className="cp-observation-chart-crosshair"
                            x1={hoveredCoords.x}
                            x2={hoveredCoords.x}
                            y1={padding.top}
                            y2={height - padding.bottom}
                        /> }
                    <circle
                        className="cp-observation-chart-marker"
                        cx={hoveredCoords.x}
                        cy={hoveredCoords.y}
                        r={6}
                        fill={paintAt(hoveredSeries, hoveredCoords.x)}
                    />
                </> }
        </svg>
    );
}
