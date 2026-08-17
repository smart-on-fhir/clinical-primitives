import type { Observation, ObservationReferenceRange } from "fhir/r4";
import { cleanUnit } from "./utils";

/**
 * Reference intervals for charting: what counts as normal for one reading, and
 * where that answer came from.
 *
 * Kept apart from {@link getObservationStatus} in `utils.ts` on purpose. That
 * function answers "is this observation abnormal" for a card or a table, folding
 * every component together into one verdict. Drawing needs the opposite: the
 * numeric bounds for one specific series, point by point, because a verdict
 * cannot tell you where a line crosses.
 */

/** Which side of its interval a reading falls on. */
export type RangeStatus = "normal" | "high" | "low";

export interface Bounds {
    /** Lower bound, in the reading's own unit. Absent for a one-sided interval. */
    low?: number,

    /** Upper bound, in the reading's own unit. Absent for a one-sided interval. */
    high?: number
}

export interface ResolvedRange extends Bounds {
    /**
     * Where the numbers came from. Worth carrying, because these are not equally
     * strong claims: a range the performing laboratory reported alongside the
     * specimen beats one looked up in a table, and both beat `manual` — an
     * interval a reader typed in, which no source published and which nothing
     * but their own recollection stands behind.
     *
     * `carried` is weaker again in a different way. The numbers came from a real
     * source, but from a *different specimen* — see {@link carryForward}. It is
     * the only source that says nothing about the reading it is attached to, so
     * a chart drawing one has to show that it is inferred.
     */
    source: "observation" | "table" | "manual" | "carried",

    /**
     * Set when the bounds above are not the ones the source quoted, but a
     * viewer's own relaxation of them. Carried so a chart can say so: an
     * adjusted interval is a third and much weaker thing than either source,
     * and presenting it unmarked would state a reference interval nobody
     * published.
     */
    overridden?: RangeOverride
}

/**
 * A reader's own limits, replacing whatever the sources give for one analyte.
 *
 * The use this exists for: within a sick cohort, a population interval flags
 * nearly every reading, and the flagging stops distinguishing anyone. A
 * clinician reading an IBD chart may want the ceiling on an inflammatory marker
 * lifted, or the floor on hemoglobin dropped, so that what stands out is
 * unusual *for these patients* rather than unusual for the healthy.
 *
 * Absolute values, in the reading's own unit. "Flag CRP above 15" is a claim a
 * clinician can make and check; the same limit as a factor requires knowing the
 * published number it multiplies, which is nowhere on the chart.
 *
 * The two sides are independent, which is what keeps this from being blunter
 * than it needs to be. An untouched side goes on resolving per reading — an
 * age-banded analyte still changes its floor part-way along the record while its
 * ceiling is pinned to what the reader asked for. Only what is overridden goes
 * flat across the series.
 *
 * This is a display control and nothing more. The result is not a reference
 * interval, is not clinically sourced, and must never be presented as one — see
 * {@link ResolvedRange.overridden}.
 *
 * Values that cross leave an interval with no normal band at all, which the
 * chart can only draw as a hard edge between the two abnormal zones.
 * {@link RangeAdjuster} will not let a reader reach that state; anything setting
 * these directly has to keep them apart itself.
 */
export interface RangeOverride {
    /**
     * Lower bound to use instead of the resolved one. Absent leaves it to the
     * sources; `null` withdraws it — see below.
     */
    low?: number | null,

    /** Upper bound to use instead of the resolved one. Same convention. */
    high?: number | null
}

/**
 * `null` is not a bound of zero; it withdraws the bound.
 *
 * A reader who does not accept an interval needs somewhere to go other than
 * pushing it out until it stops flagging anything, which leaves a limit on the
 * chart that they have decided is wrong. Withdrawing it says the honest thing
 * instead: nothing here is being assessed. With both sides withdrawn there is no
 * interval at all, and the curve goes back to its plain series color.
 */

/** Whether an override replaces or withdraws anything. */
export function isOverridden(override?: RangeOverride): boolean {
    return override !== undefined && (override.low !== undefined || override.high !== undefined);
}

/**
 * Apply a reader's limits over one reading's resolved bounds.
 *
 * A side the override says nothing about keeps whatever resolved for this
 * reading, which is what lets one bound be pinned while the other goes on
 * varying. A side set to a number takes it whether or not anything resolved
 * there — this is also how an analyte with no published interval at all gets
 * one.
 */
export function applyOverride({ low, high }: Bounds, override?: RangeOverride): Bounds {
    if (!isOverridden(override)) return { low, high };

    const side = (bound?: number, replacement?: number | null) =>
        replacement === undefined ? bound : replacement ?? undefined;

    return {
        low : side(low,  override!.low),
        high: side(high, override!.high)
    };
}

/**
 * Supplies bounds for readings that do not carry their own.
 *
 * Called once per point rather than once per series, because the answer can
 * legitimately differ between two readings of the same analyte: a record
 * spanning childhood crosses age bands, and a laboratory may revise its
 * intervals mid-record. Returning `null` means "no applicable interval", which
 * leaves that reading uncolored rather than assumed normal.
 */
/**
 * What a resolver hands back: bounds, and optionally what kind of source they
 * came from.
 *
 * `source` is how a resolver that is not consulting a table — a reader's own
 * typed-in interval, say — keeps {@link ResolvedRange.source} from describing it
 * as one. Left out, which is what every ordinary lookup does, the answer is
 * taken as a table.
 */
export interface ResolverBounds extends Bounds {
    source?: "table" | "manual"
}

export type ReferenceRangeResolver = (context: {
    observation: Observation,

    /**
     * The component being plotted, for observations that keep their values in
     * `component`. Undefined when the series plots the observation's own value.
     */
    componentCode?: string,

    /**
     * Unit of the value being plotted, already normalized by {@link cleanUnit}.
     * A resolver MUST compare this against its own table's unit and decline on
     * a mismatch rather than converting. A table quoting platelets in `10*9/L`
     * against data reported in `10*3/uL` differs by a factor of 1000, and
     * comparing them regardless would flag an entirely ordinary series as
     * critically low, with no sign that anything had gone wrong.
     */
    unit: string | null,

    /**
     * When the specimen was taken. Age-dependent intervals must be resolved
     * against this, never against today: a chart spanning childhood crosses
     * bands, and using the patient's current age would recolor their entire
     * history on their birthday.
     */
    time: number
}) => ResolverBounds | null;

/**
 * One row of a reference table: an interval, and who it applies to.
 *
 * Shaped after the tables these actually come from, which quote a band per age
 * range and occasionally per sex. Every field is optional because real tables
 * are ragged — an analyte may be banded by age and not sex, may quote only a
 * ceiling, and may have a row reserved with the numbers not yet filled in.
 */
export interface AgeBand extends Bounds {
    /**
     * Age band in years: low inclusive, high exclusive. So a source's "6–8 y",
     * meaning a child through the end of their eighth year, is written 6 to 9.
     *
     * Keeping that convention in the data rather than in the comparison is what
     * stops the off-by-one being reinvented at each call site. Both absent means
     * the interval is not age-restricted.
     */
    ageLowYears?: number,
    ageHighYears?: number,

    /** Set where the interval differs by sex. */
    sex?: "male" | "female",

    /**
     * Unit these numbers are quoted in. Compared against the reading's own, and
     * a mismatch declines the band rather than converting it.
     *
     * Optional because tables state it either per row or once for the analyte.
     * Left out, {@link matchBand}'s `declaredUnit` stands in — and a band with
     * neither is unchecked, which is the one way to lose the guard.
     */
    unit?: string
}

/**
 * Age in whole years at a given instant.
 *
 * Deliberately takes the moment as an argument instead of reading the clock. An
 * age-banded interval has to be resolved against the date the specimen was
 * taken: a record spanning childhood crosses bands part-way along, and resolving
 * every reading against the patient's age today would apply one band to a whole
 * history and silently re-color all of it on their birthday.
 */
export function ageYearsAt(birthDate: string, time: number): number | null {
    const born = new Date(birthDate).getTime();
    if (!Number.isFinite(born) || !Number.isFinite(time) || time < born) return null;

    // Calendar difference rather than elapsed milliseconds divided by 365.25:
    // the latter drifts, and around a band edge the drift is the whole answer.
    const from = new Date(born);
    const to   = new Date(time);

    let years = to.getUTCFullYear() - from.getUTCFullYear();

    const beforeBirthday =
        to.getUTCMonth() < from.getUTCMonth() ||
        (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate());

    if (beforeBirthday) years--;

    return years;
}

/**
 * The band applying to one reading, or null where none does.
 *
 * Declines rather than guesses, in every case where it cannot be sure: no band
 * covers the age, the age is unknown and the bands are age-restricted, the band
 * is sex-specific and the sex is not recorded, the units disagree. The
 * alternative is a chart stating a clinical finding on the strength of an
 * interval that does not apply to this patient — an uncolored line says "not
 * assessed", which is true, where a colored one would say "abnormal", which
 * would not be.
 *
 * A band that matches but quotes no numbers also declines. Those rows are
 * placeholders in the source — an analyte someone has reserved a line for and
 * not yet filled in — and they carry no more meaning than an absent row.
 */
export function matchBand(
    bands: AgeBand[],
    context: {
        age : number | null,
        sex?: string,

        /** The unit the reading was reported in. */
        unit: string | null,

        /**
         * Unit to check bands that state none of their own against — the one
         * the analyte is quoted in.
         *
         * Here because tables put the unit in one of two places: on each row, as
         * an exported CSV usually does, or once for the analyte with the rows
         * assuming it. Without this a table of the second kind would pass bands
         * with no `unit` and lose the check entirely, which is precisely the
         * silent thousand-fold mis-grading the comparison exists to stop.
         */
        declaredUnit?: string
    }
): Bounds | null {
    const match = bands.find(band => {
        const bandUnit = band.unit ?? context.declaredUnit;
        // An interval quoted for one sex says nothing about the other, and
        // nothing at all about a patient whose sex is unrecorded.
        if (band.sex && band.sex !== context.sex) return false;

        // Compared, never converted: a ceiling of 5 quoted in mg/L against data
        // reported in mg/dL is wrong by a factor of ten, and comparing them
        // anyway would flag an ordinary series as grossly abnormal with nothing
        // on the chart to suggest anything had gone wrong.
        if (bandUnit && context.unit && cleanUnit(bandUnit) !== context.unit) return false;

        // A row with neither bound is a reserved line, not an assertion that
        // this analyte has no interval.
        if (band.low === undefined && band.high === undefined) return false;

        const banded = band.ageLowYears !== undefined || band.ageHighYears !== undefined;
        if (!banded) return true;

        if (context.age === null) return false;

        return (band.ageLowYears  === undefined || context.age >= band.ageLowYears) &&
               (band.ageHighYears === undefined || context.age <  band.ageHighYears);
    });

    return match ? { low: match.low, high: match.high } : null;
}

/**
 * Fill gaps in a series' intervals from the last reading that had one.
 *
 * Laboratories commonly report a reference interval on some results and not
 * others, which leaves a curve alternating between colored and plain — a chart
 * that looks broken rather than one that looks partly unassessed. This carries
 * the last known interval forward across those gaps.
 *
 * Forward only, and never across a change of unit: an interval carried into a
 * different unit is the silent mis-grading that every other decision in this
 * file is arranged to prevent. Points before the first resolved interval are
 * left alone — there is nothing behind them to carry, and reaching backwards
 * from the first one would be a second, separate assumption.
 *
 * What this is claiming is that the interval did not change between two
 * specimens. Usually true and never guaranteed, which is why the result is
 * marked {@link ResolvedRange.source} `"carried"` rather than passed off as
 * whatever the original was: it is an inference about a reading, drawn from a
 * different reading, and a chart has to be able to say so.
 *
 * @param points In time order. Each carries its resolved interval, or null, and
 *               the unit its own value was reported in.
 */
export function carryForward(
    points: { range: ResolvedRange | null, unit: string | null }[]
): (ResolvedRange | null)[] {
    let last: { range: ResolvedRange, unit: string | null } | undefined;

    return points.map(point => {
        if (point.range) {
            last = { range: point.range, unit: point.unit };
            return point.range;
        }

        if (!last) return null;

        // Both known and different: not comparable, and this is the one place a
        // wrong answer would look entirely deliberate.
        if (last.unit !== null && point.unit !== null && last.unit !== point.unit) return null;

        return { ...last.range, source: "carried" as const };
    });
}

/**
 * FHIR interpretation codes, grouped by which side of the interval they name.
 *
 * Only codes that identify a *direction* are listed. Generic abnormal flags —
 * `A`, `AA` — say a reading is out of range without saying which way, so they
 * cannot place it above or below and are deliberately absent.
 */
const HIGH_CODES = ["H", "HH", "HU", "H>"];
const LOW_CODES  = ["L", "LL", "LU", "L<"];
const NORMAL_CODES = ["N", "NL"];

/**
 * The reading's own verdict, where the laboratory recorded one.
 *
 * This outranks any comparison we could make ourselves. A laboratory's
 * interpretation can account for things a static interval does not — the assay
 * used, a delta check against the previous specimen, a known interfering
 * substance — so where it disagrees with the arithmetic, it wins.
 *
 * It carries no numbers, though, which is why it cannot replace bounds: knowing
 * a reading is high does not say where between it and its neighbor the line
 * crossed over.
 */
export function readInterpretation(
    observation: Observation,
    componentCode?: string
): RangeStatus | null {
    const source = componentCode
        ? (observation.component ?? []).find(component =>
            (component.code?.coding ?? []).some(coding => coding.code === componentCode)
          )
        : observation;

    for (const interpretation of source?.interpretation ?? []) {
        for (const coding of interpretation.coding ?? []) {
            const code = coding.code ?? "";
            if (HIGH_CODES.includes(code))   return "high";
            if (LOW_CODES.includes(code))    return "low";
            if (NORMAL_CODES.includes(code)) return "normal";
        }
    }

    return null;
}

/**
 * Pick the interval that describes ordinary health, out of however many the
 * observation carries.
 *
 * `referenceRange` is a repeating element and the entries are not
 * interchangeable: an observation may quote a therapeutic range, a recommended
 * intake, or a critical threshold beside the normal one. Charting any of those
 * as though it were the normal interval would color a perfectly ordinary
 * reading as abnormal, so anything explicitly typed as something else is
 * skipped. An untyped entry is taken as normal, which is what the great
 * majority of real records emit.
 */
function pickNormalRange(ranges: ObservationReferenceRange[]): ObservationReferenceRange | undefined {
    const usable = ranges.filter(range => range.low?.value !== undefined || range.high?.value !== undefined);

    return usable.find(range =>
        (range.type?.coding ?? []).some(coding => coding.code === "normal")
    ) ?? usable.find(range => range.type === undefined);
}

/**
 * Bounds the observation reported for itself, if any.
 *
 * These are the strongest source available: they came from the laboratory that
 * ran the specimen, already expressed in the unit it reported the value in, and
 * already reflecting the patient's age, sex and the assay actually used. Nothing
 * we could look up improves on that.
 */
export function boundsFromObservation(
    observation: Observation,
    componentCode: string | undefined,
    unit: string | null
): Bounds | null {
    const ranges = componentCode
        ? (observation.component ?? []).find(component =>
            (component.code?.coding ?? []).some(coding => coding.code === componentCode)
          )?.referenceRange
        : observation.referenceRange;

    const range = pickNormalRange(ranges ?? []);
    if (!range) return null;

    // A bound whose unit is stated and disagrees with the value's is not
    // comparable, and converting it is not this component's job — a factor of
    // 1000 between `10*3/uL` and `10*9/L` would color half a chart wrongly and
    // look entirely deliberate doing it. An absent unit is read as the value's
    // own, which is both the specification's intent and what records emit.
    const comparable = (quantity?: { value?: number, unit?: string }) =>
        quantity?.value !== undefined &&
        Number.isFinite(quantity.value) &&
        (!quantity.unit || !unit || cleanUnit(quantity.unit) === unit);

    const low  = comparable(range.low)  ? range.low!.value  : undefined;
    const high = comparable(range.high) ? range.high!.value : undefined;

    return low === undefined && high === undefined ? null : { low, high };
}

/**
 * Resolve one reading's interval, preferring what the record itself says.
 *
 * The record's own bounds always win. A table is a generalization about a
 * population; the observation's `referenceRange` is a statement about this
 * specimen, from the laboratory that measured it.
 *
 * `override` is applied last, over whichever source won. Deliberately here
 * rather than by wrapping `fallback`: a resolver is only ever consulted for
 * readings that carry no interval of their own, so limits applied there would
 * reach the table-sourced rows and silently miss the rest. A reader's threshold
 * is a statement about the cohort, not about provenance, so it has to reach
 * both — and it has to work where nothing resolved at all, which is the case a
 * fallback resolver cannot be written for.
 */
export function resolveRange(
    observation: Observation,
    componentCode: string | undefined,
    unit: string | null,
    time: number,
    fallback?: ReferenceRangeResolver,
    override?: RangeOverride
): ResolvedRange | null {
    const own = boundsFromObservation(observation, componentCode, unit);
    const base: ResolverBounds | null = own ?? fallback?.({ observation, componentCode, unit, time }) ?? null;

    if (!base && !isOverridden(override)) return null;

    // `applyOverride` returns the two numbers alone, which is what keeps a
    // resolver's own `source` from leaking through and outranking the one
    // decided here.
    const applied = applyOverride(base ?? {}, override);

    // Both sides withdrawn is the same answer as having found nothing: there is
    // no interval to draw against, and reporting an empty one would leave the
    // tooltip quoting a range with no numbers in it.
    if (applied.low === undefined && applied.high === undefined) return null;

    return {
        ...applied,
        // With nothing resolved underneath, the reader's own figures are the
        // whole interval, and `manual` is the only honest thing to call it.
        source    : own ? "observation" : base ? base.source ?? "table" : "manual",
        overridden: isOverridden(override) ? override : undefined
    };
}

/**
 * Where a value sits relative to its bounds.
 *
 * Bounds are treated as inclusive — a reading exactly at the upper limit is
 * normal, not high — which is how reference intervals are conventionally quoted
 * and, more practically, keeps a flat series sitting on its own limit from
 * rendering as entirely abnormal.
 */
export function statusFor(value: number, bounds: Bounds): RangeStatus {
    if (bounds.high !== undefined && value > bounds.high) return "high";
    if (bounds.low  !== undefined && value < bounds.low)  return "low";
    return "normal";
}

/**
 * How wide the borderline zone is on each side of a limit, as a fraction of the
 * interval's own width.
 *
 * At the default 0.2 the line is the series color across the middle 20–80% of
 * the interval, borderline from 80% out to 120% and from 20% down to -20%, and
 * fully abnormal past either of those. So the limit itself is the middle of a
 * borderline zone rather than a cliff — which is what a consensus interval
 * covering most of a healthy population actually is.
 *
 * Relative to the interval rather than to the limit value: an interval's own
 * width is the only scale that means the same thing across analytes whose
 * numbers differ by orders of magnitude.
 */
export const RANGE_MARGIN = 0.3;

/** The value boundaries at which the line changes color. */
export interface RangeZones {
    /** At or above this, fully abnormal. */
    highRed?: number,

    /** The upper limit itself — the middle of the upper borderline zone. */
    high?: number,

    /** At or below this, the upper limit no longer tints the line. */
    highGreen?: number,

    /** At or above this, the lower limit no longer tints the line. */
    lowGreen?: number,

    /** The lower limit itself. */
    low?: number,

    /** At or below this, fully abnormal. */
    lowRed?: number
}

/**
 * Project an interval onto the value boundaries the chart colors between.
 *
 * A two-sided interval measures the margin against its own width, which is what
 * makes 20/80/120 mean the same thing for a CRP ceiling of 5 mg/L and a platelet
 * ceiling of 400. A one-sided interval has no width to measure against, so it
 * falls back to the magnitude of the single limit it does have — the best
 * available stand-in, and the reason a one-sided interval's zones are a weaker
 * claim than a two-sided one's.
 *
 * A zero-width interval, or a lone limit of zero, leaves no room for a margin at
 * all: the zones collapse onto the limit and the color steps rather than ramps.
 * That is the honest outcome, since nothing about such an interval says how far
 * past it is far.
 */
export function rangeZones({ low, high }: Bounds, margin = RANGE_MARGIN): RangeZones {
    const spread = low !== undefined && high !== undefined
        ? high - low
        : Math.abs(high ?? low ?? 0);

    const step = Math.abs(spread) * margin;

    return {
        highRed  : high !== undefined ? high + step : undefined,
        high,
        highGreen: high !== undefined ? high - step : undefined,
        lowGreen : low  !== undefined ? low  + step : undefined,
        low,
        lowRed   : low  !== undefined ? low  - step : undefined
    };
}

/**
 * One reading's interval, projected onto the plot.
 *
 * Every boundary is carried as a screen coordinate: converting them is the
 * caller's job, since only the chart knows its own scale. Ordered here as they
 * appear down the plot, highest value first.
 */
export interface RangeBand {
    /** Screen y at and above which the reading is fully abnormal. */
    highRedY?: number,

    /** Screen y of the upper limit. */
    highY?: number,

    /** Screen y below which the upper limit stops tinting the line. */
    highGreenY?: number,

    /** Screen y above which the lower limit stops tinting the line. */
    lowGreenY?: number,

    /** Screen y of the lower limit. */
    lowY?: number,

    /** Screen y at and below which the reading is fully abnormal. */
    lowRedY?: number
}

/** One plotted reading, in screen coordinates, with its interval mapped alongside. */
export interface BoundedPoint extends RangeBand {
    x: number,

    /** Whether this reading's interval was inferred from an earlier one. */
    carried?: boolean
}

/** A stretch of the curve over which one interval applies. */
export interface BoundRun extends RangeBand {
    /** Screen x the stretch starts at. */
    from: number,

    /** Screen x the stretch ends at. */
    to: number,

    carried?: boolean
}

/** The band's boundaries, in the order they appear down the plot. */
const BAND_KEYS = ["highRedY", "highY", "highGreenY", "lowGreenY", "lowY", "lowRedY"] as const;

/**
 * Split the readings into stretches sharing one interval.
 *
 * The reason this is needed at all is that a reference interval is not
 * guaranteed to hold for a whole series. A record spanning an age band changes
 * interval part-way along; a laboratory may revise its limits; and some readings
 * carry no interval whatsoever, which is its own kind of stretch — one that gets
 * no coloring rather than a color meaning "normal".
 *
 * Runs meet at the midpoint between the last reading of one and the first of the
 * next. The change happened somewhere between the two specimens and there is
 * nothing to say where, so the midpoint at least does not attribute it to either
 * reading. The stretches are contiguous by construction, so the curve is never
 * left with a gap in it.
 *
 * @param left  Screen x to extend the first stretch back to.
 * @param right Screen x to extend the last stretch out to.
 */
export function boundRuns(points: BoundedPoint[], left: number, right: number): BoundRun[] {
    if (points.length === 0) return [];

    // Provenance joins the boundaries in the key. A carried interval usually has
    // numbers identical to the one it came from — that is what carrying means —
    // so without this the two would merge into a single run and the inferred
    // stretch would become indistinguishable from the reported one.
    const key = (point: BoundedPoint) =>
        [...BAND_KEYS.map(name => point[name]), point.carried ? "carried" : ""].join("|");

    const spans: { start: number, end: number }[] = [];
    let start = 0;

    for (let index = 1; index <= points.length; index++) {
        if (index === points.length || key(points[index]) !== key(points[start])) {
            spans.push({ start, end: index - 1 });
            start = index;
        }
    }

    return spans.map((span, index) => {
        const band: RangeBand = {};
        for (const name of BAND_KEYS) band[name] = points[span.start][name];

        return {
            from: index === 0
                ? left
                : (points[spans[index - 1].end].x + points[span.start].x) / 2,
            to: index === spans.length - 1
                ? right
                : (points[span.end].x + points[spans[index + 1].start].x) / 2,
            carried: points[span.start].carried,
            ...band
        };
    });
}

/** How far outside its interval a reading is, in the three steps the chart draws. */
export type RangeTone = "normal" | "borderline" | "abnormal";

/** One stop on the stroke's gradient: where it sits, and what it means there. */
export interface RangeGradientStop {
    /** Fraction along the gradient vector, 0 at its start. */
    offset: number,

    tone: RangeTone
}

export interface RangeGradient {
    /**
     * Screen y the gradient vector runs between. Deliberately not the plot's own
     * edges: a boundary can fall outside the visible scale, and stretching the
     * vector to reach it is what keeps every stop at its true height. Clamping
     * the offsets instead would drag the color ramp out of place — the limit
     * would stop lining up with where the curve actually crosses it.
     */
    from: number,
    to: number,

    stops: RangeGradientStop[]
}

/**
 * Gradient stops coloring a curve by where it sits relative to its interval.
 *
 * This works — and works exactly — because being out of range is a predicate on
 * the value alone. A reading is high if it is above the limit, whatever moment
 * it was taken at, so on the chart the condition depends only on y. A gradient
 * down the plot is therefore not an approximation of the crossing: it *is* the
 * crossing, evaluated by the renderer at whatever resolution it paints, with no
 * cubic to solve and nothing to recompute when the geometry moves.
 *
 * Returns `null` when the curve cannot be tinted anywhere on the visible scale —
 * no limits, or every boundary lying off it — so the caller can stroke a plain
 * color instead of carrying a gradient that would be one flat hue.
 */
/**
 * @param top    Top of the plot area. Not the top of the SVG: the gutters hold
 *               axis labels and no part of the curve, so a zone reaching only
 *               into one of them can tint nothing and should be dropped.
 * @param bottom Bottom of the plot area, likewise.
 */
export function rangeGradientStops(band: RangeBand, top: number, bottom: number): RangeGradient | null {
    if (bottom <= top) return null;

    const { highRedY, highY, highGreenY, lowGreenY, lowY, lowRedY } = band;

    // A limit whose whole zone sits off an edge cannot tint any part of the
    // curve that actually gets drawn.
    const highApplies = highY !== undefined && (highGreenY ?? highY) > top;
    const lowApplies  = lowY  !== undefined && (lowGreenY  ?? lowY)  < bottom;

    if (!highApplies && !lowApplies) return null;

    // In increasing y — that is, from the highest value down to the lowest.
    const marks: { y: number, tone: RangeTone }[] = [];

    if (highApplies) {
        marks.push({ y: highRedY   ?? highY!, tone: "abnormal" });
        marks.push({ y: highY!,               tone: "borderline" });
        marks.push({ y: highGreenY ?? highY!, tone: "normal" });
    }

    if (lowApplies) {
        marks.push({ y: lowGreenY ?? lowY!, tone: "normal" });
        marks.push({ y: lowY!,              tone: "borderline" });
        marks.push({ y: lowRedY   ?? lowY!, tone: "abnormal" });
    }

    // An interval narrow enough that its two borderline zones overlap would
    // otherwise run its stops backwards, collapsing rather than inverting.
    let previous = -Infinity;
    for (const mark of marks) {
        previous = mark.y = Math.max(previous, mark.y);
    }

    // Beyond the outermost mark the color does not change again, so the ends
    // simply continue whatever tone they reached.
    const from = Math.min(top, marks[0].y);
    const to   = Math.max(bottom, marks[marks.length - 1].y);
    const span = to - from;

    if (span <= 0) return null;

    return {
        from,
        to,
        stops: [
            { y: from, tone: marks[0].tone },
            ...marks,
            { y: to,   tone: marks[marks.length - 1].tone }
        ].map(mark => ({ offset: (mark.y - from) / span, tone: mark.tone }))
    };
}

/**
 * Which of the three tones a reading falls in.
 *
 * Used for the marks — a hovered point, a lone reading — so that a dot sits in
 * the same color as the line passing through it. It reads the same boundaries
 * {@link rangeGradientStops} does, which is what keeps the two from ever
 * disagreeing about a reading.
 */
export function toneFor(value: number, bounds: Bounds, margin = RANGE_MARGIN): RangeTone {
    const zones = rangeZones(bounds, margin);

    // Abnormal on either side is checked before borderline on either side, so a
    // reading past one limit is not talked down by being near the other. They
    // can overlap when an interval is narrower than twice its margin.
    if (zones.highRed !== undefined && value >= zones.highRed) return "abnormal";
    if (zones.lowRed  !== undefined && value <= zones.lowRed)  return "abnormal";

    if (zones.highGreen !== undefined && value > zones.highGreen) return "borderline";
    if (zones.lowGreen  !== undefined && value < zones.lowGreen)  return "borderline";

    return "normal";
}
