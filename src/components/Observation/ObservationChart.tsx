import { useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Observation } from "fhir/r4";
import { splinePath } from "./spline";
import { escapeTooltipMarkdown } from "../Tooltip";
import { cleanUnit, unitScale } from "./utils";
import {
    boundRuns,
    carryForward,
    isOverridden,
    rangeGradientStops,
    readInterpretation,
    resolveRange,
    rangeZones,
    statusFor,
    type RangeOverride,
    type RangeGradient,
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

/**
 * How a caller says which observations a chart is about.
 *
 * A code, for the ordinary case. Several codes where one analyte is coded
 * differently across sources — CRP is `1988-5` in one feed and `14959-1` in the
 * next, and a chart handed only one of them draws a fraction of the trend. A
 * predicate where neither is enough: records that carry no usable coding at all
 * can only be found by their own words, and that test is the caller's to write
 * rather than this component's to guess at.
 *
 * Note for anyone passing the latter two: they are dependencies of the chart's
 * memoized resolution pass. Built inline they are a fresh value every render,
 * which re-resolves every reading on every pointer move of a drag. Hold them.
 */
export type ObservationSelector = string | string[] | ((obs: Observation) => boolean);

function matchesCode(obs: Observation, selector: ObservationSelector): boolean {
    if (typeof selector === "function") return selector(obs);

    const codes = typeof selector === "string" ? [selector] : selector;

    return (obs.code?.coding ?? []).some(coding =>
        coding.code !== undefined && codes.includes(coding.code));
}

/**
 * What to call a selector when a chart has to name it — an empty state, a
 * tooltip with nothing better to fall back on.
 *
 * Null for a predicate, which has no name to give: the caller who wrote it knows
 * what it is for, and printing a function is worse than saying nothing. Callers
 * pass `label` for that case.
 */
function selectorLabel(selector: ObservationSelector): string | null {
    if (typeof selector === "string") return selector;
    if (typeof selector === "function") return null;
    return selector.length > 0 ? selector.join(", ") : null;
}

/**
 * When a reading happened, or null if the record does not say in a form that
 * can be placed on an axis.
 *
 * Exported because a caller stacking these charts has to agree with them about
 * which readings are plottable at all. A section that counted a reading this
 * function rejects would give it a row and then have nothing to draw in it.
 */
export function observationTime(obs: Observation): number | null {
    const raw = obs.effectiveDateTime || obs.issued;
    if (!raw) return null;
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? null : time;
}

/**
 * A quantity's value as a number, or null where there is not one.
 *
 * Coerced rather than type-checked, because servers do send `"5.4"` where the
 * specification asks for a decimal, and a reading is not worth discarding over
 * how it was serialized. `null` is rejected explicitly: coercing it gives 0,
 * which would plot an absent value as a real reading of zero.
 *
 * Exported for the same reason {@link observationTime} is — a caller deciding
 * which analytes are worth a row has to answer "is there anything to plot" the
 * same way the chart will.
 */
export function quantityValue(quantity?: { value?: number, unit?: string }): number | null {
    if (quantity?.value === undefined || quantity.value === null) {
        return null;
    }

    const value = Number(quantity.value);

    return Number.isFinite(value) ? value : null;
}

/**
 * What identifies one component within its observation, for selecting a series.
 *
 * A code where there is one, and the component's own text where there is not.
 * The text is not a code and cannot be looked up anywhere, but it is what
 * distinguishes one component from the next in the records that carry no codings
 * at all — flowsheet-derived observations frequently do. Without the fallback
 * such an observation has no addressable series, so the chart infers none and
 * draws nothing, which is a worse answer than plotting a line named by its text.
 *
 * Null where neither is present: a component nothing can refer to cannot be
 * plotted, because `readValue` would have no way to find it again.
 */
function componentKey(component: NonNullable<Observation["component"]>[number]): string | null {
    const coded = (component.code?.coding ?? []).map(coding => coding.code).find(Boolean);
    return coded ?? component.code?.text ?? null;
}

/**
 * Read one series' value out of an observation, as a number and its unit.
 *
 * Only `valueQuantity` and `valueInteger` are trusted. Both are unambiguously
 * numeric; every other value type would have to be parsed out of a display
 * string, which turns results like "2+ protein" into plausible-looking data
 * points. A `valueInteger` carries no unit, which is right for what it is
 * normally used for — a score, whose numbers mean nothing outside the
 * instrument that defines them.
 */
function readValue(obs: Observation, spec: ObservationChartSeries) {
    const source = spec.code
        ? (obs.component ?? []).find(component => componentKey(component) === spec.code)
        : obs;

    const quantity = source?.valueQuantity;

    // `??` rather than `||`: a reading of zero is a reading.
    const value = quantityValue(quantity)
        ?? (Number.isFinite(source?.valueInteger) ? source!.valueInteger! : null);

    return value === null
        ? null
        : { value, unit: quantity?.unit ? cleanUnit(quantity.unit) : null };
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
    // Plottable values, not merely present ones. A record whose own value
    // cannot be read as a number, while its components can, is one that draws
    // from its components — inferring a single empty series from the unreadable
    // value would leave the chart with nothing at all.
    if (observations.some(obs => readValue(obs, {}) !== null)) {
        return [{}];
    }

    const found = new Map<string, string>();

    for (const obs of observations) {
        for (const component of obs.component ?? []) {
            const key = componentKey(component);

            if (key === null || readValue(obs, { code: key }) === null) continue;

            const coding = (component.code?.coding ?? [])[0];

            if (!found.has(key)) {
                found.set(key, component.code?.text ?? coding?.display ?? key);
            }
        }
    }

    return [...found].map(([code, label]) => ({ code, label }));
}

/**
 * The unit a series is plotted in, and how each reading gets there.
 *
 * One row is one y-axis, so every point on it has to be in one unit. Records do
 * not cooperate: a laboratory changes reporting convention mid-record, two feeds
 * merged into one row disagree, and a single LOINC code can legitimately arrive
 * either way — body weight lists `[lb_av]` beside `kg`, prealbumin `mg/dL`
 * beside `g/dL`. Plotting those raw puts 4.2 and 0.042 on one scale and calls
 * the difference a hundredfold drop.
 *
 * The declared unit wins where there is one, because that is what any reference
 * interval is quoted in and converting toward it is what lets the interval
 * apply. Otherwise the most common unit among the readings — most common rather
 * than first, so a single stray reading cannot drag the whole series onto its
 * scale.
 *
 * A declaration no reading can reach is ignored rather than honored. It is
 * almost always a mistake — a display label like "systolic / diastolic, mmHg"
 * written where a unit belongs, or a typo — and honoring it would convert
 * nothing, drop every reading, and leave a well-populated analyte reporting that
 * it has nothing to plot. The data is the fact; the declaration is a hint about
 * how to read it, and a hint that fits none of the data is worth less than the
 * data. Where *some* readings can reach it the declaration stands and the rest
 * are dropped and counted, which is the case this is all built for.
 */
function canonicalUnit(units: (string | null)[], declared?: string): string | null {
    const present = units.filter((unit): unit is string => unit !== null);

    if (declared) {
        const target = cleanUnit(declared);

        if (present.length === 0 || present.some(unit => unitScale(unit, target) !== null)) {
            return target;
        }
    }

    const counts = new Map<string, number>();
    for (const unit of present) counts.set(unit, (counts.get(unit) ?? 0) + 1);

    let best: string | null = null;
    for (const [unit, n] of counts) if (best === null || n > counts.get(best)!) best = unit;

    return best;
}

/**
 * One reading's value in the series' unit, or null if it cannot get there.
 *
 * A reading that reports no unit at all is taken at face value: there is nothing
 * to convert and nothing to disagree with, and dropping it would discard the
 * bare `valueInteger` scores that carry no unit by design.
 */
function inCanonical(reading: { value: number, unit: string | null }, unit: string | null): number | null {
    if (unit === null || reading.unit === null || reading.unit === unit) return reading.value;

    const scale = unitScale(reading.unit, unit);

    return scale === null ? null : reading.value * scale;
}

/**
 * What {@link ObservationChart} would draw for a code, without drawing it.
 *
 * For callers deciding whether an analyte is worth a row at all. It runs the
 * chart's own pipeline — the same code filter, the same date rule, the same
 * series inference, the same value reader — so the two cannot answer the
 * question differently. Anything less than that is a second implementation of
 * "is there a trend here", and the two drift: a caller that counted a reading
 * the chart discards gives the analyte a row, and the chart then fills it with
 * "No numeric observations for code …".
 *
 * An empty `values` is the signal to leave the analyte out.
 */
export function plottableReadings(
    observations: Observation[],
    code: ObservationSelector,
    declaredUnit?: string
): {
    values: number[],
    unit  : string | null,

    /** How many lines the chart would draw — more than one for a panel. */
    series: number,

    /**
     * Readings the chart would leave out because their unit cannot be converted
     * to the series' own — a molar result among mass ones, say.
     *
     * Reported rather than absorbed. A silently thinned series reads as though
     * the patient stopped being tested, which is a different and more
     * comfortable claim than the truth, so a caller has to be able to say what
     * happened.
     */
    dropped: number,

    /**
     * The units those readings were reported in, deduplicated.
     *
     * Carried so the omission can be explained rather than merely counted. "12
     * readings hidden" invites the reader to assume a bug; "12 readings hidden,
     * reported in pmol/L" tells them what to go and fix.
     */
    droppedUnits: string[]
} {
    const matching = observations
        .filter(obs => matchesCode(obs, code) && observationTime(obs) !== null);

    const values: number[] = [];

    let unit   : string | null = null;
    let series  = 0;
    let dropped = 0;

    const droppedUnits = new Set<string>();

    for (const spec of inferSeries(matching)) {
        const readings = matching
            .map(obs => ({ reading: readValue(obs, spec), time: observationTime(obs) }))
            .filter(entry => entry.reading !== null && entry.time !== null);

        const seriesUnit = canonicalUnit(readings.map(e => e.reading!.unit), declaredUnit);

        // Keyed by time, as the chart does it, so two readings at the same
        // instant count once here as well — otherwise a badge would report more
        // readings than the row has points.
        const byTime = new Map<number, number>();

        for (const { reading, time } of readings) {
            const value = inCanonical(reading!, seriesUnit);

            if (value === null) {
                dropped++;
                if (reading!.unit) droppedUnits.add(reading!.unit);
                continue;
            }

            byTime.set(time!, value);
        }

        // A series the chart would drop for having no points is not a line.
        if (byTime.size === 0) continue;

        values.push(...byTime.values());
        unit ??= seriesUnit;
        series++;
    }

    return { values, unit, series, dropped, droppedUnits: [...droppedUnits] };
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
 * A short, stable digest of everything a gradient draws with.
 *
 * Only needs to change whenever the gradient does, and to survive in an `id`
 * attribute — so a plain string hash in base 36 is enough, and collisions
 * between two shapes of the same gradient would be indistinguishable anyway.
 */
function gradientSignature(gradient: RangeGradient | null): string {
    if (!gradient) return "none";

    const description = `${gradient.from}|${gradient.to}|` +
        gradient.stops.map(stop => `${stop.offset.toFixed(4)}:${stop.tone}`).join(",");

    let hash = 5381;
    for (let index = 0; index < description.length; index++) {
        hash = ((hash * 33) ^ description.charCodeAt(index)) >>> 0;
    }

    return hash.toString(36);
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
    rangeOverride,
    carryRange = false,
    declaredUnit,
    selectedId,
    onSelectPoint,
    abnormalColor = "hsl(340deg, 70%, 55%)",
    warningColor = "hsl(280deg, 70%, 50%)",
    className
}: {
    observations: Observation[],

    /**
     * Which observations to plot — a LOINC code, typically. Several codes, or a
     * predicate, where one code does not gather the analyte; see
     * {@link ObservationSelector} for the memoization this then requires.
     */
    code: ObservationSelector,

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
     * Limits of the reader's own, in the reading's unit, for judging a series
     * against a sick cohort rather than against the healthy population — see
     * {@link RangeOverride}.
     *
     * Applies over whatever interval was resolved, the observation's own
     * included, so a panel does not judge some rows by the reader's limits and
     * others by the published ones depending on which records happened to quote
     * bounds. It also supplies an interval where nothing resolved at all.
     *
     * A side left `undefined` goes on resolving per reading, so one bound can be
     * pinned while the other keeps varying.
     *
     * Purely a display control. While it is in effect the chart marks its
     * readings as overridden, and callers showing one should say so too: the
     * result is nobody's published reference interval.
     */
    rangeOverride?: RangeOverride,

    /**
     * Fill readings that resolved no interval from the last reading that did —
     * see {@link carryForward}.
     *
     * Off by default, and deliberately. Laboratories often report an interval on
     * some results and not others, which leaves a curve alternating between
     * colored and plain and looking broken rather than partly unassessed; this
     * fixes that. But it does so by asserting an interval over a specimen whose
     * report did not carry one, and "the chart looks patchy" is not on its own a
     * good enough reason to make a clinical claim. Turn it on where you know the
     * gaps are reporting artifacts rather than genuine absences.
     *
     * Carried stretches are drawn dashed and say so in the tooltip, so the
     * inference is visible on the chart rather than only in the props.
     */
    carryRange?: boolean,

    /**
     * The unit this chart plots in. Readings reported in another are converted
     * where the two differ only by scale, and left out where they do not.
     *
     * Worth setting whenever you know it. One axis can only carry one unit, and
     * left to infer, the chart takes the most common unit among the readings —
     * a reasonable guess, but it can put the series on a different scale than
     * the reference interval is quoted in, at which point the interval stops
     * applying. Naming the unit the interval uses keeps the two together.
     */
    declaredUnit?: string,

    /**
     * `Observation.id` of the reading to draw as selected, if it is on this
     * chart. A chart that does not hold it draws nothing, which is what lets a
     * stack of charts share one selection: every row is told the same id and only
     * the row that has it marks anything.
     */
    selectedId?: string,

    /**
     * Called with the reading nearest a click.
     *
     * Nearest rather than hit-tested, deliberately: the same rule the hover
     * marker follows, so whatever is highlighted under the pointer is what a
     * click takes. Hit-testing the marks instead would make dense series
     * unclickable and would leave most of the plot inert.
     *
     * Not called for a reading whose observation has no id — there would be
     * nothing to pass back as {@link selectedId}, so the click could never show
     * as having landed.
     */
    onSelectPoint?: (observation: Observation) => void,

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

    // Everything that depends on the record rather than on the view, held across
    // renders as one unit.
    //
    // Selecting this chart's readings out of the record, resolving an interval
    // for each one and judging it against that interval is the expensive part of
    // drawing a row, and none of it changes when the chart is panned or zoomed —
    // only where the results land does. Stacked in a timeline, this component
    // re-renders on every pointer move of a drag, once per row, each pass
    // walking the whole record again.
    //
    // What is left outside is the geometry, in `ObservationPlot`, which genuinely
    // does change per frame.
    const { resolved, heading, unit } = useMemo(() => {
        const matching = observations
            .filter(obs => matchesCode(obs, code))
            .map(obs => ({ obs, time: observationTime(obs) }))
            .filter((entry): entry is { obs: Observation, time: number } => entry.time !== null)
            .sort((a, b) => a.time - b.time);

        const specs = series ?? inferSeries(matching.map(entry => entry.obs));

        const overridden = isOverridden(rangeOverride);

        const resolved: ResolvedSeries[] = specs.map((spec, index) => {
        // Keyed by time so two readings at the same instant cannot produce a
        // zero-width segment; the later one wins, as it would in a table.
        const byTime = new Map<number, ResolvedPoint>();

        // One axis, so one unit — decided across the whole series before any
        // point is placed, and every reading converted into it or left out. See
        // `canonicalUnit`.
        const unit = canonicalUnit(
            matching.map(entry => readValue(entry.obs, spec)?.unit ?? null),
            declaredUnit
        );

        let dropped = 0;

        for (const { obs, time } of matching) {
            const reading = readValue(obs, spec);
            if (!reading) continue;

            const value = inCanonical(reading, unit);

            // Not convertible: a molar result among mass ones, or a unit this
            // component has no arithmetic for. Left out rather than plotted,
            // and counted so the omission can be reported — see `dropped`.
            if (value === null) { dropped++; continue; }

            // Resolved per reading rather than once per series: the answer can
            // legitimately differ down the line, when a record spans an age band
            // or a laboratory revises its interval.
            //
            // Asked in the series' unit, not the reading's own, because that is
            // the unit the value has now. A reading converted from mg/dL into
            // g/dL must be graded against a g/dL interval; asking with mg/dL
            // would fetch bounds a hundred times too large and read every point
            // as unremarkable.
            const range = resolveRange(obs, spec.code, unit, time, referenceRange, rangeOverride);

            // The laboratory's own verdict outranks our arithmetic where it gave
            // one; the comparison is what fills in the far more common case of a
            // range with no interpretation beside it.
            //
            // Except under an adjustment, where it is deliberately ignored. The
            // laboratory flagged the reading against the published interval, and
            // the whole point of relaxing that interval is to stop seeing those
            // flags. Honoring it anyway would leave a point labeled High while
            // the line through it is drawn well inside the widened band.
            const status = (overridden ? null : readInterpretation(obs, spec.code))
                ?? (range ? statusFor(value, range) : null);

            byTime.set(time, { x: time, y: value, obs, range, status });
        }

        const first = matching[0]?.obs;

        // Applied here rather than inside `resolveRange`, which answers about
        // one reading and cannot see its neighbors. The points are already in
        // time order — `byTime` was filled from a sorted list — which is what
        // makes "the last one that had an interval" meaningful at all.
        const points = [...byTime.values()].sort((a, b) => a.x - b.x);

        if (carryRange) {
            const carried = carryForward(points.map(point => ({
                range: point.range,
                unit : readValue(point.obs, spec)?.unit ?? null
            })));

            carried.forEach((range, index) => {
                if (points[index].range === range) return;

                points[index].range = range;

                // Its status has to be recomputed: the point resolved as
                // unassessed and was drawn in the plain series color, and now
                // there is an interval to place it against. The laboratory's own
                // interpretation still outranks the comparison where it gave
                // one, exactly as it does above.
                points[index].status = (overridden ? null : readInterpretation(points[index].obs, spec.code))
                    ?? (range ? statusFor(points[index].y, range) : null);
            });
        }

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
                        : label
                            ?? first?.code?.text
                            ?? first?.code?.coding?.[0]?.display
                            ?? selectorLabel(code)
                            ?? "Value"),
            color : spec.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
            unit,
            points
        };
        }).filter(entry => entry.points.length > 0);

        return {
            resolved,
            heading: label
                ?? matching[0]?.obs.code?.text
                ?? matching[0]?.obs.code?.coding?.[0]?.display
                ?? selectorLabel(code)
                ?? "Observations",
            unit: resolved.find(entry => entry.unit)?.unit ?? null
        };

    // `series` and `rangeOverride` belong here, and a caller building either
    // inline gets none of this back — a fresh `{}` for an analyte nobody has
    // edited is enough to invalidate the lot on every render.
    }, [observations, code, series, label, referenceRange, rangeOverride, carryRange, declaredUnit]);

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
                // "not in this record" rather than as a broken component. A
                // predicate has no name to print, so it falls back to whatever
                // the caller called the chart.
                ? <p className="cp-observation-chart-empty">
                      { selectorLabel(code)
                          ? <>No numeric observations for code <code>{selectorLabel(code)}</code>.</>
                          : <>No numeric observations for {label ?? "this analyte"}.</> }
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
                        selectedId={selectedId}
                        onSelectPoint={onSelectPoint}
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
function ObservationPlot({ resolved, width, height, heading, mapX, crosshair, minMaxLabels, selectedId, onSelectPoint, abnormalColor, warningColor }: {
    resolved     : ResolvedSeries[],
    width        : number,
    height       : number,
    heading      : string,
    mapX        ?: (time: number) => number,
    crosshair    : boolean,
    minMaxLabels : boolean,
    selectedId  ?: string,
    onSelectPoint?: (observation: Observation) => void,
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

    /** Confines an embedded chart to its own column — see where it is applied. */
    const plotClipId = `${clipPrefix}-plot`;

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
                carried   : point.range?.source === "carried",
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
        ).map((run, runIndex) => {
            const gradient = rangeGradientStops(run, padding.top, height - padding.bottom);

            return {
                ...run,
                gradient,
                // The signature is part of the id, so a gradient that changes
                // shape becomes a different paint server rather than the same
                // one with new contents. Belt and braces: browsers do generally
                // re-resolve a referenced paint server when its stops mutate
                // under a stable id, but it is the sort of thing that goes wrong
                // quietly and looks exactly like stale state when it does.
                gradientId: `${clipPrefix}-grad-${seriesIndex}-${runIndex}-${gradientSignature(gradient)}`,
                clipId    : `${clipPrefix}-run-${seriesIndex}-${runIndex}`
            };
        });

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
     * Where the selected reading sits, on each line that carries it.
     *
     * At most one per series: a multi-valued observation — blood pressure — holds
     * every component in one resource, so selecting it marks the reading on both
     * lines rather than picking one and leaving the other looking unselected.
     *
     * Collected here and drawn after every series rather than inside each one,
     * so a second line crossing the mark cannot be painted over its ring. Within
     * a single series the order was already right; with two it was not.
     */
    const selectedMarks = selectedId === undefined ? [] : plotted.flatMap(series => {
        const index = series.entry.points.findIndex(point => point.obs.id === selectedId);

        return index < 0 ? [] : [{
            key : series.entry.key,
            x   : series.scaled[index].x,
            y   : series.scaled[index].y,
            fill: paintAt(series, series.scaled[index].x)
        }];
    });

    /**
     * Track the reading nearest the cursor, in both axes.
     *
     * Hit-testing individual markers cannot give this: it only fires when the
     * pointer is actually over one, so between readings nothing is highlighted
     * and dense series need the targets shrunk until they are unusable. A
     * search over the coordinates always has an answer, so exactly one marker
     * is shown for as long as the pointer is anywhere on the chart.
     */
    const nearest = (event: { currentTarget: SVGSVGElement, clientX: number, clientY: number }): HoveredPoint | null => {
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

        return best;
    };

    const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        const best = nearest(event);

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

    /**
     * Select the reading nearest the click.
     *
     * Read from the click's own coordinates rather than from `hovered`, which is
     * only ever set by a pointer that has moved across the plot — a tap, or a
     * click that lands without a preceding move, would otherwise select whatever
     * was last hovered, or nothing at all.
     */
    const onClick = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!onSelectPoint) return;

        const found = nearest(event);
        const obs   = found ? plotted[found.series].entry.points[found.index].obs : null;

        if (!obs?.id) return;

        // The chart's content area treats a click on nothing as "drop the
        // selection". Without this the selection just made would be cleared on
        // the way up, and any range the reader had highlighted would go with it.
        event.stopPropagation();
        onSelectPoint(obs);
    };

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
            //
            // A band that has been relaxed, typed in, or carried from another
            // specimen is named as such, never "ref". None of the three is a
            // reference interval for *this* reading, and a tooltip is exactly
            // where someone would go to read the numbers off and quote them.
            ...(shownPoint.range
                ? [`${shownPoint.status === "high" ? "**High** — " : shownPoint.status === "low" ? "**Low** — " : ""}${
                    shownPoint.range.source === "manual"  ? "manual"
                  : shownPoint.range.source === "carried" ? "earlier ref"
                  : shownPoint.range.overridden           ? "adjusted"
                  : "ref"
                  } ${escapeTooltipMarkdown(formatRange(shownPoint.range))}`]
                : shownPoint.status === "high" ? ["**High**"]
                : shownPoint.status === "low"  ? ["**Low**"]
                : []),
            escapeTooltipMarkdown(new Date(shownPoint.x).toLocaleDateString())
          ].join("\n")
        : undefined;

    return (
        <svg
            className={[
                "cp-observation-chart-svg",
                mapX && "cp-observation-chart-svg--embedded",
                onSelectPoint && "cp-observation-chart-svg--selectable"
            ].filter(Boolean).join(" ")}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${heading} over time`}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHovered(null)}
            onClick={onSelectPoint ? onClick : undefined}
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
            {/* Everything the plot draws, clipped to the row's own width.

                An embedded chart lets its marks overflow vertically — a ring
                around a selected reading at the top of the row would
                otherwise be sliced off — but a series holds readings outside
                the visible time range, and those map to coordinates well left
                and right of the box. Without this the curve would go on being
                drawn across the label column and whatever sits beside the
                chart. Generous vertically, since nothing here needs clipping
                in that direction. */}
            { mapX &&
                <clipPath id={plotClipId}>
                    <rect x={0} y={-height} width={width} height={height * 3} />
                </clipPath> }

            <g clipPath={mapX ? `url(#${plotClipId})` : undefined}>
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

                                        {/* A carried interval is drawn dashed.
                                            The stretch is colored on the
                                            strength of a different specimen's
                                            reference range, and a solid line
                                            would present that inference as
                                            indistinguishable from a reported
                                            one. Dashing the stroke rather than
                                            fading it keeps the gradient's tones
                                            reading at full strength — the
                                            grading is still the real answer for
                                            the interval it was given. */}
                                        <path
                                            className={`cp-observation-chart-line${run.carried ? " cp-observation-chart-line-carried" : ""}`}
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

                {/* The dot is filled from the same paint server as the line, like
                    every other mark here, so a selected reading still reads as high
                    or low at a glance. The ring around it is opaque rather than a
                    bare outline: the curve running under the mark would otherwise
                    show through the gap between the two circles and read as a line
                    struck through the dot. */}
                { selectedMarks.map(mark => (
                    <g key={mark.key}>
                        <circle className="cp-observation-chart-selection-ring" cx={mark.x} cy={mark.y} r={8} />
                        <circle className="cp-observation-chart-selected-point" cx={mark.x} cy={mark.y} r={5} fill={mark.fill} />
                    </g>
                )) }

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
            </g>
        </svg>
    );
}
