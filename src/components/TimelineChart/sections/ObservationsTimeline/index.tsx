import { useMemo, useState } from "react";
import type { Observation, Patient } from "fhir/r4";
import { TimelineChartHighlight, TimelineChartLayer, TimelineChartRowLabel, type TimelineChartLayerProps } from "../..";
import { useTimelineChartContext } from "../../TimelineChartContext";
import { useClinicalData } from "../../../../fhir/context";
import {
    ObservationChart,
    observationTime,
    plottableReadings,
    quantityValue
} from "../../../Observation/ObservationChart";
import {
    RangeAdjuster,
    boundScale,
    editsCross,
    type RangeEdits
} from "../../../Observation/RangeAdjuster";
import { cleanUnit } from "../../../Observation/utils";
import { escapeTooltipMarkdown } from "../../../Tooltip";
import { CheckBox } from "../../../CheckBox";
import { Collapse } from "../../../Collapse";
import { ObservationDetail } from "./ObservationDetail";
import {
    // Aliased: the resolver a caller supplies is the more useful thing to call
    // `referenceRange` inside this file, and it would otherwise shadow this.
    resolveRange as resolveBounds,
    ageYearsAt,
    matchBand,
    type AgeBand,
    type Bounds,
    type ReferenceRangeResolver,
    type ResolverBounds
} from "../../../Observation/referenceRange";
import "./ObservationsTimeline.scss";

/** Tall enough for a trend to be readable, short enough to stack a dozen. */
const DEFAULT_ROW_HEIGHT = 48;

/**
 * How many analytes are checked to begin with.
 *
 * About what fits on a screen at {@link DEFAULT_ROW_HEIGHT} beside the sections
 * sharing the chart, and about as many trend lines as anyone reads at once.
 * Every row is a chart that re-measures and re-splines as the axis moves, so a
 * discovered set of forty makes dragging the chart perceptibly slower — the cap
 * is as much about that as about the reading.
 */
const DEFAULT_INITIALLY_SHOWN = 10;

/**
 * One analyte this section can give a row to.
 *
 * Deliberately thin. A panel that carries reference tables, notes and age bands
 * — as the IBD one does — is a superset of this and passes straight in, but
 * nothing here needs to know about any of that: bounds arrive through
 * `referenceRange`, not through the list of what to plot.
 */
export interface TimelineAnalyte {
    /**
     * LOINC, typically — whatever the observations are coded with.
     *
     * Several where one analyte reaches the record under more than one code, as
     * CRP does: `1988-5`, `14959-1` and `71426-1` are the same measurement, and
     * a row given only one of them draws a fraction of the trend while the rest
     * appear as separate analytes. All of them gather into the one row.
     *
     * The first entry is the analyte's identity — what range edits are keyed by,
     * and what {@link ObservationsTimeline}'s `rangeEdits` prop expects. Reorder
     * the list and you have renamed the analyte as far as those are concerned,
     * so treat the first code as fixed once anything has been keyed to it.
     */
    code: string | string[],

    label: string,

    /**
     * Words to match against a reading's own display text when none of the codes
     * do — `["c reactive protein", "crp"]`.
     *
     * For records that arrive with a local code, or no usable coding at all,
     * which is common enough in flowsheet- and extract-derived data that a
     * code-only panel silently under-reports. Matched case-insensitively as
     * substrings against `code.text` and each coding's `display`.
     *
     * A blunt instrument, deliberately kept out of the codes list so it is
     * visible as one: a keyword can claim a reading its author never meant it
     * to, and two analytes with overlapping keywords will both take it. Keep
     * them specific, and prefer a code wherever the data has one.
     */
    keywords?: string[],

    /**
     * Fallback for readings that report none of their own, and the unit
     * {@link range} is quoted in.
     */
    unit?: string,

    /**
     * Whether this analyte's row is on screen before the reader touches
     * anything.
     *
     * Opting one analyte in switches the whole section to this scheme:
     * `initiallyShown` stops applying, and an analyte that does not set it is
     * hidden regardless of where it sits in the list. That is deliberate — a
     * section where some rows are chosen by importance and others by position
     * has no rule anyone can state.
     *
     * What it buys over ordering the list is that "important enough to show" and
     * "read in this order" stop being the same decision. A panel is grouped so
     * that related analytes sit together, and the handful worth opening on are
     * scattered through those groups.
     *
     * Only ever a starting point. The reader's own checkbox wins from the first
     * click, and nothing here is hidden — everything the patient has is listed
     * in the settings whether shown or not.
     */
    defaultShown?: boolean,

    /**
     * A default reference interval for this analyte, in {@link unit}.
     *
     * Last in the chain, not first. A reading's own bounds win, then the
     * section's `referenceRange` resolver, and only then this — so a constant
     * here fills the gap for records that report nothing and analytes a table
     * does not cover, without overriding either. It is the weakest source, and
     * quietly the least trustworthy: it applies to every reading of the series
     * regardless of age, sex or assay, which is exactly what a resolver exists
     * to avoid.
     *
     * Declines on a unit mismatch, as any resolver must — a ceiling of 5 quoted
     * in mg/L against data reported in mg/dL is wrong by a factor of ten, and
     * comparing them anyway would flag an ordinary series as grossly abnormal
     * with nothing on the chart to suggest anything had gone wrong. That check
     * is against `unit`, so it must be the analyte's actual unit and not a
     * display string: `"mg/L"` applies, `"systolic / diastolic, mmHg"` declines
     * against everything and the interval silently never appears.
     *
     * A reader can still adjust it from the settings panel, and their edit is
     * badged the same way it would be over any other source. Nothing here was
     * published about this patient either, but a caller stating one interval for
     * a whole cohort is at least a decision someone made on purpose.
     */
    range?: Bounds,

    /**
     * Reference intervals that depend on the patient — by age, and where a
     * source quotes it, by sex.
     *
     * Ahead of {@link range} and behind the section's `referenceRange` resolver.
     * The two are not alternatives: bands are the real answer where a source
     * gives one, and `range` is the baseline for the ages and patients the bands
     * do not cover.
     *
     * Resolved against the date of each specimen, so a record spanning a band
     * edge changes interval part-way along rather than being graded end to end
     * against the patient's age today. Each band carries its own unit; the
     * bounds are optional, so a source quoting only a ceiling is written with
     * only a `high`, and a row reserved with the numbers not yet filled in is
     * simply skipped.
     *
     * Declines — leaving the reading unassessed rather than assumed normal —
     * where no band covers the patient's age, where the age is unknown, where a
     * band is sex-specific and the sex is not recorded, or where the units
     * disagree. See {@link matchBand}.
     */
    ranges?: AgeBand[]
}

/**
 * How a reading names itself to the chart's selection.
 *
 * A relative reference, the same shape the bar sections use, so one chart-wide
 * selection can hold a medication or an observation without either having to
 * know the other exists.
 */
function observationId(obs: Observation): string | undefined {
    return obs.id === undefined ? undefined : `Observation/${obs.id}`;
}

/** An analyte's codes, however it spelled them. */
export function analyteCodes(analyte: TimelineAnalyte): string[] {
    return typeof analyte.code === "string" ? [analyte.code] : analyte.code;
}

/**
 * What identifies an analyte across renders — range edits, checkbox state, row
 * keys.
 *
 * The first code, so a caller's `rangeEdits` can be written against a code they
 * chose rather than against a key this file invented. Falls back to the label
 * only for the degenerate case of an analyte declared with no codes at all,
 * which can still match on keywords and so still needs a key.
 */
export function analyteKey(analyte: TimelineAnalyte): string {
    return analyteCodes(analyte)[0] ?? analyte.label;
}

/** Whether one of the analyte's codes appears among the reading's codings. */
function codeHit(analyte: TimelineAnalyte, obs: Observation): boolean {
    const codes = new Set(analyteCodes(analyte));

    return (obs.code?.coding ?? []).some(coding =>
        coding.code !== undefined && codes.has(coding.code));
}

/** Every name the record gives a reading, lowercased into one string. */
function readingText(obs: Observation): string {
    return [obs.code?.text, ...(obs.code?.coding ?? []).map(coding => coding.display)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

/**
 * The longest of the analyte's keywords that the reading's own text contains,
 * as a length — zero for none.
 *
 * A length rather than a boolean because two analytes can both match by keyword
 * and only one can have the reading. Length stands in for specificity, which is
 * crude but right in the cases that occur: "prealbumin" beats "albumin" for a
 * result named Prealbumin, and that is exactly the pair that goes wrong.
 *
 * Matched on word boundaries rather than as bare substrings. Without that, `mch`
 * claims MCHC, `alt` claims anything with "elastase" or "cobalt" in its name,
 * and `ast` claims gastrin — abbreviations are short enough that free substring
 * matching finds them everywhere.
 */
function keywordHit(analyte: TimelineAnalyte, obs: Observation): number {
    const keywords = analyte.keywords ?? [];
    if (keywords.length === 0) return 0;

    const text = readingText(obs);

    let best = 0;

    for (const keyword of keywords) {
        const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Bounded by anything that is not alphanumeric, so a keyword can sit at
        // either end of the text and can itself contain spaces or hyphens —
        // "c reactive protein", "pre-albumin", "25-oh" all behave.
        if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text)) {
            best = Math.max(best, keyword.length);
        }
    }

    return best;
}

/**
 * Whether a reading belongs to an analyte, considered on its own.
 *
 * A union of the two tests rather than keywords as a fallback for an unmatched
 * code: a reading carrying a code from some local dictionary is not "uncoded",
 * so a fallback would never fire for exactly the records the keywords were added
 * for. Either test claiming the reading is enough.
 *
 * Deliberately blind to the other analytes, which is why the section does not
 * use it to decide rows — see {@link assignOwners}. Exported for callers who
 * want to ask about one analyte in isolation.
 */
export function analyteMatcher(analyte: TimelineAnalyte): (obs: Observation) => boolean {
    return obs => codeHit(analyte, obs) || keywordHit(analyte, obs) > 0;
}

/**
 * Which analyte each reading belongs to, decided across the whole list at once.
 *
 * Necessary because "does this analyte match" is the wrong question. Laboratory
 * names nest: LOINC calls MCV "MCV [Entitic mean volume] in **Red Blood
 * Cells**", MCHC "MCHC … in **Red Blood Cells**", RDW "**Erythrocyte**
 * distribution width", ESR "**Erythrocyte** [Sedimentation Rate]". An RBC row
 * with the obvious keywords claims all four, and asked one analyte at a time
 * there is no way to notice, because each of them is also right on its own
 * terms. The result is a row labeled RBC plotting distribution widths, on a
 * scale inferred from whichever of them happened to be commonest.
 *
 * So ownership is exclusive and decided in two passes:
 *
 * 1. **A code beats a name.** A reading coded 787-2 is MCV's, whatever its
 *    display text says, because a code is an assertion by whoever wrote the
 *    record and a keyword is a guess by whoever wrote the panel.
 * 2. **A reading that names a LOINC code no analyte claims belongs to nobody**,
 *    and its text is not consulted. This is what stops the panel swallowing
 *    tests it does not contain: HbA1c is `4548-4` and is not an anemia measure,
 *    but its name contains "hemoglobin"; nucleated red cells are `30392-5` and
 *    sit at zero in a healthy patient, but their name contains "RBC". Both used
 *    to land in rows that then plotted them as though they were something else.
 *    A record that named itself in LOINC has already said what it is.
 * 3. **Otherwise the longest matching keyword wins** — the specificity tiebreak
 *    above — with ties going to list order, so the outcome is at least stable
 *    and statable.
 *
 * Step 2 turns on the coding *system*, not merely on a code being present:
 * keywords exist for records coded in a local dictionary or not usefully coded
 * at all, and those must still be reachable. Only an explicit LOINC coding is
 * treated as the record having identified itself.
 */
export function assignOwners(
    analytes: TimelineAnalyte[],
    observations: Observation[]
): Map<Observation, string> {
    const owners = new Map<Observation, string>();

    for (const obs of observations) {
        const byCode = analytes.find(analyte => codeHit(analyte, obs));

        if (byCode) {
            owners.set(obs, analyteKey(byCode));
            continue;
        }

        // Coded in LOINC, and no analyte wanted that code: the reading is some
        // other test, and its name is not evidence to the contrary.
        const loincCoded = (obs.code?.coding ?? []).some(coding =>
            coding.code !== undefined && coding.system === "http://loinc.org");

        if (loincCoded) continue;

        let bestKey: string | null = null;
        let bestLen = 0;

        for (const analyte of analytes) {
            const length = keywordHit(analyte, obs);

            if (length > bestLen) {
                bestLen = length;
                bestKey = analyteKey(analyte);
            }
        }

        if (bestKey !== null) owners.set(obs, bestKey);
    }

    return owners;
}

/**
 * What this analyte has that is plottable for the patient in hand.
 *
 * Asked of the chart rather than worked out here. This decides which analytes
 * get a row, and a row is only worth having where the chart would draw
 * something in it — so the question has to be answered by whatever is going to
 * answer it later anyway.
 *
 * The unit is the patient's own lab's. A panel carries a unit too, but that is
 * whatever its reference table assumed, and labeling a patient's values with it
 * would misreport any lab using a different one — even where the two happen to
 * be numerically equivalent.
 */
const readingsFor = plottableReadings;

/**
 * Everything numeric in the record, as analytes to plot.
 *
 * What the section falls back to when no list is supplied. A caller who has a
 * panel in mind should pass it — the count of what is missing is only meaningful
 * against a list of what was expected — but a caller who simply wants to see the
 * record should not have to enumerate it first.
 *
 * Ordered by how much there is to plot, so the analytes with a trend worth
 * reading are at the top rather than wherever the bundle happened to put them.
 */
function discoverAnalytes(observations: Observation[]): TimelineAnalyte[] {
    const found = new Map<string, TimelineAnalyte & { count: number }>();

    for (const obs of observations) {
        // Undated readings are left out for the same reason non-numeric ones
        // are: this list becomes the section's rows, and a row is only worth
        // having where there is something to plot in it.
        if (observationTime(obs) === null) continue;

        // Its own quantity, or the first of its components — the latter is what
        // keeps a multi-valued observation like blood pressure from being read
        // as having no numbers in it at all. Only for the unit: whether there is
        // anything to plot is a separate question, asked below.
        const quantity = quantityValue(obs.valueQuantity) !== null
            ? obs.valueQuantity
            : (obs.component ?? []).map(component => component.valueQuantity)
                .find(value => quantityValue(value) !== null);

        // Nothing numeric anywhere in the record — a coded finding, a free-text
        // result, a panel that only points at its members. There is no trend to
        // draw for it, so it is left out rather than given a row that would
        // render as an error.
        //
        // A bare `valueInteger` counts, which is how a score with no unit gets
        // discovered at all. Discovery is deliberately the looser test of the
        // two: a code that turns out to have nothing plottable is dropped later,
        // when the section asks the chart what it would actually draw.
        const numeric = quantityValue(quantity) !== null
            || Number.isFinite(obs.valueInteger)
            || (obs.component ?? []).some(component => Number.isFinite(component.valueInteger));

        if (!numeric) continue;

        const coding = (obs.code?.coding ?? [])[0];
        const code   = coding?.code;

        if (!code) continue;

        const existing = found.get(code);

        if (existing) {
            existing.count++;
        } else {
            found.set(code, {
                code,
                label: obs.code?.text ?? coding?.display ?? code,
                unit : quantity?.unit ? cleanUnit(quantity.unit) : undefined,
                count: 1
            });
        }
    }

    return [...found.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map(({ count: _count, ...analyte }) => analyte);
}

/**
 * An analyte's declared interval, as a resolver's answer.
 *
 * Null where there is nothing to say, and — importantly — where the unit does
 * not match. A resolver that converted here, or compared regardless, would be
 * the one place in this file that can silently mis-grade a whole series; see
 * {@link ReferenceRangeResolver} on why every resolver has to decline instead.
 *
 * Reported as a table rather than as `manual`. It is a constant somebody wrote
 * into a configuration, which is a weaker claim than a lookup but a stronger one
 * than a figure typed into the sidebar a moment ago.
 */
function declaredBounds(analyte: TimelineAnalyte, unit: string | null): ResolverBounds | null {
    const { low, high } = analyte.range ?? {};

    if (low === undefined && high === undefined) return null;

    const declared = analyte.unit ? cleanUnit(analyte.unit) : null;

    // Only where both are known. An analyte that names no unit is taken at its
    // word, as a reading whose own unit is absent is — there is nothing to
    // disagree with.
    if (declared !== null && unit !== null && declared !== unit) return null;

    return { low, high, source: "table" };
}

/**
 * The chain for one analyte: the section's resolver, then the analyte's own
 * age bands, then its flat baseline.
 *
 * Composed here rather than inside `resolveRange` because the analyte is this
 * file's concept — the shared resolver takes an observation and has no idea
 * which row is asking.
 *
 * Ordered weakest-last throughout. A caller's resolver may know things no
 * declaration can; bands are specific to this patient at this date; the flat
 * range is specific to nothing at all and exists to cover what the bands do
 * not. Each step is consulted only where everything above it declined, so a
 * baseline can never displace a band that actually applies.
 *
 * Returns the caller's own resolver untouched when the analyte declares nothing,
 * so an unremarkable analyte adds no wrapper and no identity churn.
 */
function analyteResolver(
    analyte: TimelineAnalyte,
    resolver: ReferenceRangeResolver | undefined,
    patient: { birthDate?: string, gender?: string } | undefined
): ReferenceRangeResolver | undefined {
    const bands = analyte.ranges ?? [];
    const flat  = analyte.range ?? {};

    const declares = bands.length > 0 || flat.low !== undefined || flat.high !== undefined;

    if (!declares) return resolver;

    return context => {
        const found = resolver?.(context);
        if (found) return found;

        if (bands.length > 0) {
            // Age at the specimen, never today — see `ageYearsAt`. A patient
            // with no recorded birth date has no age to band against, which the
            // matcher treats as a reason to decline rather than to ignore the
            // bands.
            const age = patient?.birthDate ? ageYearsAt(patient.birthDate, context.time) : null;
            // `declaredUnit` so bands that state no unit of their own are still
            // checked, against the one the analyte is quoted in. A table that
            // puts the unit on the analyte rather than on each row would
            // otherwise be compared against nothing at all.
            const banded = matchBand(bands, {
                age,
                sex         : patient?.gender,
                unit        : context.unit,
                declaredUnit: analyte.unit
            });

            if (banded) return { ...banded, source: "table" };
        }

        return declaredBounds(analyte, context.unit);
    };
}

/**
 * The interval currently applying to each analyte, as of its latest reading.
 *
 * Needed because "this analyte has a reference interval" is not a property of
 * the analyte. Bounds resolve per reading — a table's resolver declines on an
 * age band it does not cover, on an unrecorded sex, on a unit mismatch — so an
 * analyte can have bounds for some of a patient's readings and none for the
 * rest.
 *
 * The latest reading is the one asked, because that is the interval a clinician
 * reading the chart today is working against, and because a control has to open
 * on one figure rather than on however many the record spans. Editing a side
 * replaces it for the whole series; leaving it alone lets it go on resolving
 * per reading as before.
 */
function publishedByAnalyte(
    entries: {
        key    : string,
        match  : (obs: Observation) => boolean,
        resolve: ReferenceRangeResolver | undefined
    }[],
    observations: Observation[]
): Map<string, Bounds> {
    const published = new Map<string, Bounds>();

    // Walked per analyte rather than once over the record keyed by coding, which
    // is what this did while an analyte was one code. It cannot be: an analyte
    // gathering three codes has one latest reading across all of them, and
    // keying by coding would answer with the latest under whichever code the
    // lookup happened to use — a stale interval wherever the feeds interleave.
    for (const { key, match, resolve } of entries) {
        let latest: { time: number, bounds: Bounds } | undefined;

        for (const obs of observations) {
            if (!match(obs)) continue;

            const quantity = obs.valueQuantity;
            if (quantityValue(quantity) === null) continue;

            const time = observationTime(obs);
            if (time === null) continue;

            // No override passed: what a source publishes does not depend on
            // what a reader has typed over it, and asking with one would leave
            // the control opening on its own last answer.
            const bounds = resolveBounds(obs, undefined, quantity!.unit ? cleanUnit(quantity!.unit) : null, time, resolve);
            if (!bounds) continue;

            if (latest === undefined || time > latest.time) {
                latest = { time, bounds: { low: bounds.low, high: bounds.high } };
            }
        }

        if (latest) published.set(key, latest.bounds);
    }

    return published;
}

/**
 * A short badge for a row whose interval a reader has edited, and the sentence
 * behind it.
 *
 * Every edited row carries one. A limit somebody typed is not a reference
 * interval, and a chart drawn against one has to say so on its face — a
 * screenshot of it will outlive any control in a sidebar.
 *
 * The badge reads "custom" rather than the figures. The numbers are already on
 * the chart, at the heights they occupy; what the label has to carry is the one
 * thing the chart cannot show, which is that they did not come from anywhere.
 */
export function editBadge(
    edits: RangeEdits | undefined,
    published: Bounds,
    unit: string | null
): { short: string, full: string } | null {
    if (!edits) return null;

    const say = (edit: number | null | undefined, side: "high" | "low") => {
        // Untouched, or typed back to exactly what applies anyway: nothing has
        // been claimed here that the sources do not already say.
        if (edit === undefined || edit === published[side]) return null;

        // A withdrawn bound only says something where there was one to withdraw.
        if (edit === null) return published[side] === undefined ? null : `${side} bound not applied`;

        return `${side} ${edit}${unit ? " " + unit : ""}`;
    };

    const parts = [say(edits.high, "high"), say(edits.low, "low")].filter(Boolean) as string[];

    if (parts.length === 0) return null;

    const withdrawn = parts.every(part => part.endsWith("not applied"));

    return {
        // Both sides withdrawn leaves no interval at all, which is worth saying
        // in one phrase rather than as two absences.
        short: withdrawn && parts.length === 2 ? "no range" : "custom",
        full : `Custom range — ${parts.join(", ")}. Not a published reference interval.`
    };
}

/**
 * A TimelineChart section stacking one trend line per analyte.
 *
 * Each row is an {@link ObservationChart} sharing the chart's horizontal scale,
 * so a rise in CRP lines up with the medication that preceded it rather than
 * sitting on its own private time axis.
 *
 * Only analytes the patient actually has are given a row. A panel of empty
 * frames would imply the labs were drawn and came back unremarkable, which is a
 * different claim from never having been ordered — so absences are counted in
 * the narrative instead.
 *
 * Every row's reference interval can be edited from the settings panel, in the
 * analyte's own unit. That is here rather than in any one specialty's section
 * because the need is not specialty-specific: a population interval flags nearly
 * every reading in any sick cohort, at which point it has stopped
 * distinguishing anyone.
 */
export function ObservationsTimeline({
    observations,
    analytes,
    patient,
    carryRange = true,
    label = "Observations",
    title = "Observations",
    rowHeight = DEFAULT_ROW_HEIGHT,
    initiallyShown = DEFAULT_INITIALLY_SHOWN,
    showAbsent = true,
    referenceRange,
    rangeEdits,
    settings
}: {
    /**
     * The readings to plot. Left out, the section takes the patient's own from
     * {@link useClinicalData} — a clinical component in a loaded chart should
     * not have to be handed the record it is already sitting in.
     */
    observations?: Observation[],

    /**
     * Which analytes to give rows to. Left out, everything numeric in the record
     * gets one, most-measured first.
     *
     * Passing a list does two things discovery cannot. It gathers an analyte
     * that reaches the record under several codes, or under none — discovery
     * keys on a reading's first coding, so CRP arriving as `1988-5` from one
     * feed and `14959-1` from another becomes two half-empty rows. And it makes
     * the narrative's counts mean something: "three more are tracked but absent
     * from this record" is a statement about an expected panel, and there is
     * nothing to say where the list came from the record itself.
     *
     * A caller who wants the first without the second — a catalog of everything
     * an application can chart, rather than a panel a clinician expects — passes
     * the list with `showAbsent={false}`.
     */
    analytes?: TimelineAnalyte[],

    /**
     * Whose age and sex {@link TimelineAnalyte.ranges} are resolved against.
     * Defaults to the loaded patient, which is what a section sitting in a chart
     * of one person's record wants; pass it to grade someone else's readings.
     */
    patient?: Patient,

    /**
     * Fill readings that resolved no interval from the last reading that did.
     *
     * Off by default. It makes a curve with intermittently-reported ranges read
     * as one assessed series rather than a broken-looking alternation, but does
     * so by asserting an interval over specimens that reported none — turn it on
     * where you know those gaps are a reporting artifact. Carried stretches draw
     * dashed and say "earlier ref" in the tooltip. See {@link carryForward}.
     */
    carryRange?: boolean,

    label?: TimelineChartLayerProps['label'],

    /** Heading for the section's own settings and narrative panel. */
    title?: string,

    /** Height of each analyte's row, in pixels. */
    rowHeight?: number,

    /**
     * How many analytes are checked when the section first appears. The rest are
     * listed unchecked in the settings panel, a click away.
     *
     * A cap rather than a cut: nothing is dropped, and the counts go on
     * describing the whole record. Raise it for a section whose panel is meant to
     * be read whole, or pass `Infinity` to check everything — a discovered set
     * can run to dozens of analytes, which is both unreadable stacked and slow to
     * redraw while the chart is dragged.
     *
     * Ignored entirely where any analyte sets {@link TimelineAnalyte.defaultShown},
     * which is a statement about which rows matter rather than how many.
     */
    initiallyShown?: number,

    /**
     * Whether tracked analytes that are absent from the record are listed at
     * all.
     *
     * Absent only. An analyte the record does have but the chart cannot draw —
     * a coded finding, a free-text result — is listed either way, marked "not
     * chartable". Hiding those would tell a reader the patient has no such
     * result when the record holds one, which is the one thing this section
     * must not say.
     *
     * On by default, which is the point of declaring a panel: a greyed-out row
     * and a count of what is absent distinguish a lab that was never ordered
     * from one this section does not know about, and that distinction is
     * clinical rather than cosmetic.
     *
     * Turn it off for a list that is a lookup table rather than a claim — a
     * catalog of every analyte an application might chart, passed in whole so
     * that codes and keywords are resolved here, with no expectation that any
     * given patient has any given entry. There, the absences are an artifact of
     * the catalog's size and reporting them says nothing about the patient. The
     * counts go quiet with the rows: an absence nobody is shown is not one the
     * narrative should be totting up either.
     */
    showAbsent?: boolean,

    /**
     * Where reference bounds come from when a reading carries none of its own.
     *
     * Consulted per reading, with the specimen's date and unit, so an
     * age-banded analyte changes interval part-way along a record rather than
     * being graded against the patient's age today.
     *
     * Omitted, only the records' own intervals and any {@link TimelineAnalyte.range}
     * apply — the full order being the reading's own bounds, then this, then the
     * analyte's declared default, then whatever the reader has typed over the
     * result.
     */
    referenceRange?: ReferenceRangeResolver,

    /**
     * Starting range edits, keyed by analyte code — the first, for an analyte
     * carrying several, per {@link TimelineAnalyte.code} — what each analyte's inputs
     * open on, and what "Reset ranges" returns them to.
     *
     * Absolute limits, in each analyte's own unit, whether or not anything
     * published an interval for it. Pass a set your service has agreed on to
     * open the panel on it; leave it out and every analyte starts at whatever
     * its records and `referenceRange` say.
     *
     * Uncontrolled from there — the inputs own the values, so a preset does not
     * have to be lifted into the caller's state to be editable. Edited rows are
     * marked wherever they appear, since the result is not a reference interval
     * anyone published.
     */
    rangeEdits?: Record<string, RangeEdits>,

    /** Extra content appended below this section's own settings. */
    settings?: TimelineChartLayerProps['settings']
}) {
    const { toPercent, selectedPointId, setSelectedPointId } = useTimelineChartContext();
    const { resources, patient: loadedPatient } = useClinicalData();

    // An explicit patient still wins — a caller plotting someone else's readings
    // has to be able to say whose age bands to grade them against.
    const subject = patient ?? loadedPatient ?? undefined;

    // Memoized so the fallback is a stable array: every derivation below is
    // keyed on it, and a fresh one each render would rebuild all of them.
    const obs = useMemo(
        () => observations ?? ((resources.Observation ?? []) as unknown as Observation[]),
        [observations, resources.Observation]
    );

    const tracked = useMemo(
        () => analytes ?? discoverAnalytes(obs),
        [analytes, obs]
    );

    // Only the analytes the reader has decided about, by code.
    //
    // Their choices rather than the resulting visibility, because everything
    // else is a default that has to stay live: the record can arrive after the
    // first render, and a set of hidden codes computed at mount would have been
    // computed over nothing. Holding only what was actually toggled lets the
    // default go on applying to whatever turns up, and keeps an untouched
    // analyte following the section rather than pinned to an answer nobody gave.
    const [choices, setChoices] = useState<Record<string, boolean>>({});

    const [edits, setEdits] = useState<Record<string, RangeEdits>>(rangeEdits ?? {});

    // Every analyte that could in principle be charted, whether or not this
    // patient has any. Kept whole so the settings list can show what the section
    // covers, rather than silently omitting the ones that were never drawn.
    //
    // Held across renders, and this is the one that has to be: it walks every
    // observation once per analyte, and the section re-renders on every pointer
    // move while the chart is dragged. Rebuilt each frame, a record of a few
    // thousand readings against a discovered set of analytes was doing hundreds
    // of thousands of comparisons per frame before anything was drawn — which is
    // exactly as slow as it sounds, and gets worse the more the patient has.
    //
    // The matcher is built here rather than where each row draws, and for the
    // same reason: the chart holds its resolved readings against it, so a
    // predicate rebuilt per render would re-resolve every reading of every row on
    // every pointer move — the exact cost this memo exists to avoid.
    //
    // Nothing in it depends on the visible range, the selection or the reader's
    // checkboxes, so none of those need to invalidate it.
    // Decided once across the whole list, then read per analyte. A reading
    // belongs to exactly one row, and which row cannot be worked out by asking
    // the rows one at a time — see `assignOwners`.
    const owners = useMemo(() => assignOwners(tracked, obs), [tracked, obs]);

    const chartable = useMemo(
        () => tracked.map(analyte => {
            const key   = analyteKey(analyte);
            const match = (candidate: Observation) => owners.get(candidate) === key;

            // Filtered once here rather than inside `readingsFor`, so that
            // "the record has this analyte" and "the chart can draw it" are
            // two answers off one pass instead of two walks of the record.
            const matching = obs.filter(match);

            return {
                analyte,
                match,
                key,
                // The section's resolver with the analyte's own default behind
                // it. Carried per row so the chart, the published-bounds lookup
                // and the settings panel all consult one chain — a control
                // opening on a figure the chart is not drawing against would be
                // worse than no control.
                resolve  : analyteResolver(analyte, referenceRange, subject),
                // Whether the analyte is in the record at all, plottable or
                // not — a coded finding, a free-text result, an undated one.
                // Replaces an analyte having to declare itself unplottable:
                // the component is already looking at the values, and a
                // caller's assertion about them could only be wrong.
                recorded : matching.length > 0,
                // The analyte's own unit is handed down so the row plots in the
                // unit its bands are quoted in, rather than in whichever unit
                // happens to be commonest among the readings.
                readings : readingsFor(matching, () => true, analyte.unit)
            };
        }),
        [tracked, obs, owners, referenceRange, subject]
    );

    // What the sources say for each analyte. Rebuilt only when the analytes, the
    // readings or the resolver change: this walks every observation, and the
    // inputs that read it re-render on every keystroke of the settings panel.
    //
    // Deliberately blind to the edits themselves. Were a typed bound to count
    // here, each control would open on its own last answer instead of on what
    // the sources say, and there would be no way back to the published figure.
    // The resolver reaches this through `chartable`, which carries each
    // analyte's own chain — so it is not a dependency here.
    const published = useMemo(
        () => publishedByAnalyte(chartable, obs),
        [chartable, obs]
    );

    const publishedFor = (key: string): Bounds => published.get(key) ?? {};

    const anyEdited = Object.entries(edits).some(([key, entry]) =>
        editBadge(entry, publishedFor(key), null) !== null);

    // Split once, on the same terms, so the two lists below are filters of a
    // stable array rather than fresh walks.
    const withReadings = useMemo(
        () => chartable.filter(entry => entry.readings.values.length > 0),
        [chartable]
    );

    // In the record, but with nothing the chart can draw — a genotype
    // interpretation, a coded finding, a free-text result. Held apart from the
    // analytes that are simply absent, because the two are different facts about
    // the patient and only one of them is a gap in the workup.
    const notPlottable = useMemo(
        () => chartable.filter(entry => entry.recorded && entry.readings.values.length === 0),
        [chartable]
    );

    const withoutReadings = useMemo(
        () => chartable.filter(entry => !entry.recorded),
        [chartable]
    );

    // Whether the analytes name their own opening rows. One of them saying so is
    // enough to settle it for the whole section — see TimelineAnalyte.defaultShown.
    const declaresDefaults = useMemo(
        () => tracked.some(analyte => analyte.defaultShown !== undefined),
        [tracked]
    );

    // Everything the patient has, each carrying whether it is on screen.
    //
    // Unchosen means unchecked rather than absent, whichever rule decides it. A
    // dozen trend lines is more than a reader can take in at once and more than
    // the chart can redraw comfortably while being panned, but which dozen
    // matters is not something this component can know — so the rest stay one
    // click away in the panel instead of being decided for good here.
    const available = withReadings.map((entry, index) => ({
        ...entry,
        visible: choices[entry.key] ?? (declaresDefaults
            ? entry.analyte.defaultShown === true
            : index < initiallyShown)
    }));

    const shown = available.filter(entry => entry.visible);

    // The selected reading, when it is one of the rows this section is drawing.
    //
    // Derived from the chart's selection rather than remembered when a point is
    // clicked, so the panel stays right however the selection was made — and
    // empties itself when another section, or another row, takes it over.
    //
    // Scoped to the visible rows on purpose. Two sections can be looking at the
    // same record through different panels, and an observation being *in* this
    // section's data is not the same as this section showing it: without the
    // check both would claim a reading only one of them drew.
    // Asked through the rows' own matchers rather than against a set of codes,
    // so a reading claimed by keyword — which carries no code this section would
    // recognize — is still understood to belong to the row that drew it.
    const drawnHere = (obs: Observation) => shown.some(entry => entry.match(obs));

    // An index rather than a scan. Finding the selected reading is one `find`
    // over the record, which is cheap enough once — but this runs on every
    // pointer move for as long as something is selected, and a drag is where the
    // chart can least afford it.
    const byId = useMemo(() => {
        const index = new Map<string, Observation>();

        for (const candidate of obs) {
            const id = observationId(candidate);
            if (id !== undefined) index.set(id, candidate);
        }

        return index;
    }, [obs]);

    const candidate = selectedPointId ? byId.get(selectedPointId) : undefined;

    // Only if this section is drawing it. Two sections can be looking at the
    // same record through different panels, and an observation being *in* this
    // section's data is not the same as this section showing it: without the
    // check both would claim a reading only one of them drew.
    const selected = candidate && drawnHere(candidate) ? candidate : undefined;

    // The settings list, alphabetical within two groups.
    //
    // By name rather than in chart order because this list is used to find an
    // analyte, not to read one: the chart is where the rows are read, and it is
    // ordered by what is worth looking at. A panel of forty checkboxes in
    // frequency order is a linear search every time.
    //
    // Everything the patient has still comes first, and the analytes with
    // nothing to plot after it. Interleaved alphabetically those few real
    // entries would be scattered among a dozen greyed-out ones, and the list
    // would stop looking like the rows on screen at all.
    // Held for the same reason `chartable` is: `localeCompare` is not cheap, and
    // neither the names nor the record change while the chart is being dragged.
    // Only which rows are checked does, and that is applied below rather than
    // sorted for.
    const listedOrder = useMemo(() => {
        const byLabel = (a: { analyte: TimelineAnalyte }, b: { analyte: TimelineAnalyte }) =>
            a.analyte.label.localeCompare(b.analyte.label);

        // Analytes the record does have but cannot draw are listed whether or
        // not absences are — `showAbsent` is about what the patient is missing,
        // and these are not missing. A result that exists and cannot be charted
        // is the case a reader most needs told: silence there reads as "not
        // ordered", which is the opposite of what happened.
        return [
            ...[...withReadings].sort(byLabel),
            ...[...notPlottable].sort(byLabel),
            ...(showAbsent ? [...withoutReadings].sort(byLabel) : [])
        ];
    }, [withReadings, notPlottable, withoutReadings, showAbsent]);

    // Visibility is decided in chart order — the cap counts down the rows as
    // drawn — so it is looked up here rather than recomputed against this list's
    // own indices, which would check the first ten names alphabetically.
    const visibleByKey = new Map(available.map(entry => [entry.key, entry.visible]));

    const listed = listedOrder.map(entry => ({
        ...entry,
        visible: visibleByKey.get(entry.key) ?? false
    }));

    // The section's extent. Walks the whole record, so it is held too — and it
    // is deliberately keyed on what the patient has rather than on what is
    // checked: unchecking a row is a change to the view, and the chart's idea of
    // how far the data reaches should not move with it.
    const times = useMemo(
        () => obs
            .filter(obs => withReadings.some(entry => entry.match(obs)))
            .map(observationTime)
            .filter((time): time is number => time !== null),
        [obs, withReadings]
    );

    // Recorded as an answer either way, including one that agrees with the
    // default. Checking an analyte back on has to survive another arriving above
    // it and pushing it past the cap.
    const toggle = (key: string, visible: boolean) =>
        setChoices(current => ({ ...current, [key]: !visible }));

    // Counted apart from analytes simply not drawn, and reported whatever
    // `showAbsent` says: their rows are on the list either way. Only the count of
    // what is absent goes quiet with them, since a count of absences a reader
    // cannot see would read as the section having failed to draw something.
    const unplottable = notPlottable.length;
    const missing     = showAbsent ? withoutReadings.length : 0;

    return (
        <TimelineChartLayer
            label={label}
            title={title}
            rows={Math.max(1, shown.length)}
            rowHeight={rowHeight}
            dataRangeStart={times.length ? Math.min(...times) : undefined}
            dataRangeEnd={times.length ? Math.max(...times) : undefined}
            selection={selected ? <ObservationDetail observation={selected} /> : undefined}
            settings={
                <>
                    {/* Analytes with nothing to plot stay listed but disabled,
                        unless `showAbsent` says otherwise. Dropping them by
                        default would make a panel look like it only ever
                        covered what this patient happens to have, and there would
                        be no way to tell one that was never ordered from one
                        the component does not know about. */}
                    { listed.map(({ analyte, key, readings, recorded, visible }) => {
                        const empty  = readings.values.length === 0;
                        const bounds = publishedFor(key);

                        // Present in the record, but with nothing this chart can
                        // draw from it. Said in the row rather than left to the
                        // narrative, because a reader looking for the analyte
                        // looks here — and an unexplained disabled row is
                        // indistinguishable from one that was never ordered.
                        const unplottable = empty && recorded;
                        const unit   = readings.unit ?? analyte.unit;

                        // Offered only for rows on screen — limits on a hidden
                        // row change something nobody can see — and only where
                        // the row draws a single line. One pair of bounds cannot
                        // describe two series: offered on blood pressure it
                        // would apply the systolic threshold to diastolic as
                        // well, and flag every reading it touched.
                        const scale = visible && readings.series === 1
                            ? boundScale(readings.values, bounds)
                            : null;

                        // What RangeAdjuster itself would decline to render, asked
                        // in advance: a caret opening onto nothing is worse than
                        // no caret, so the row has to know before it draws one.
                        const adjustable = Boolean(unit && scale);

                        const header = (
                            // Greyed out only for a genuine absence. A row the
                            // record does have keeps full contrast even though
                            // its checkbox is dead — dimming it would file it
                            // with the labs that were never ordered, which is
                            // the one thing this state has to not say.
                            <span className={`cp-observations-timeline-setting${empty && !unplottable ? " cp-timeline-setting-disabled" : ""}`}>
                                {/* Its own hit target now. The header toggles the
                                    collapse, so without this a click meant to
                                    hide a row would open its range settings at
                                    the same time. The name beside it belongs to
                                    the collapse rather than to the checkbox,
                                    which is the trade for putting both on one
                                    line. */}
                                <span onClick={event => event.stopPropagation()}>
                                    <CheckBox
                                        checked={visible}
                                        disabled={empty}
                                        onChange={() => toggle(key, visible)}
                                        aria-label={`Show ${analyte.label}`}
                                    />
                                </span>
                                <span className="cp-observations-timeline-setting-name">{analyte.label}</span>
                                <span className="cp-text-txt-6 cp-text-xs" style={{ whiteSpace: "nowrap" }}>
                                    {/* Both badges carry the app's own tooltip
                                        rather than a `title`. These are the two
                                        places the panel reports something a
                                        reader cannot otherwise see — that a
                                        result exists but cannot be drawn, or
                                        that some were left out — and a native
                                        tooltip is a second of hovering away,
                                        unstyled, and impossible to word at
                                        length. Both are the answer to "why does
                                        this row look wrong", so they have to be
                                        readable. */}
                                    { unplottable
                                        ? <span
                                            className="cp-observations-timeline-unplottable"
                                            data-tooltip={[
                                                `**Recorded, but nothing to plot**`,
                                                ``,
                                                `${escapeTooltipMarkdown(analyte.label)} is in this patient's record, but its results carry no numeric value — a coded finding, a free-text result, or an interpretation rather than a measurement.`,
                                                ``,
                                                `The row is kept so the analyte is not mistaken for one that was never ordered.`
                                            ].join("\n")}
                                          >⚠ not chartable</span>
                                        : empty
                                            ? " — no readings"
                                            : <span className="cp-text-xs cp-text-txt-6 cp-fill-win-2 cp-rounded-pill cp-px-3 cp-py-1">{readings.values.length}</span> }
                                    {/* Readings left out for being in a unit
                                        this row cannot convert. Said here rather
                                        than nowhere: a series quietly missing a
                                        third of its points looks like a patient
                                        who stopped being tested. */}
                                    { readings.dropped > 0 &&
                                        <span
                                            className="cp-observations-timeline-unplottable"
                                            style={{ marginLeft: "var(--cp-space-2)" }}
                                            data-tooltip={[
                                                `**${readings.dropped} ${readings.dropped === 1 ? "reading" : "readings"} not shown**`,
                                                ``,
                                                readings.droppedUnits.length
                                                    ? `Reported in ${escapeTooltipMarkdown(readings.droppedUnits.join(", "))}, which cannot be converted to ${escapeTooltipMarkdown(unit ?? "this row's unit")} — the two measure different things, so there is no factor between them.`
                                                    : `Reported in a unit that cannot be converted to ${escapeTooltipMarkdown(unit ?? "this row's unit")}.`,
                                                ``,
                                                `Drawing them here would put values on a scale they do not belong to. They are in the record, just not on this chart.`
                                            ].join("\n")}
                                        >−{readings.dropped}</span> }
                                </span>
                            </span>
                        );

                        // A row with no settings to fold away is drawn flat, with
                        // the caret's width held open so the names still line up
                        // against the rows that do have one.
                        return adjustable ? (
                            <div className="cp-observations-timeline-setting-row" key={key}>
                                <Collapse label={header}>
                                    <RangeAdjuster
                                        label={analyte.label}
                                        unit={unit}
                                        published={bounds}
                                        scale={scale}
                                        value={edits[key] ?? {}}
                                        onChange={value => setEdits(current => ({ ...current, [key]: value }))}
                                        className="cp-observations-timeline-ranges"
                                    />
                                </Collapse>
                            </div>
                        ) : (
                            <div
                                className="cp-observations-timeline-setting-row cp-observations-timeline-setting-flat"
                                key={key}
                            >
                                {header}
                            </div>
                        );
                    }) }
                    {/* Only once something is off default — an always-present
                        reset invites the reader to wonder what it would undo. */}
                    { anyEdited &&
                        <button
                            type="button"
                            className="cp-observations-timeline-reset"
                            onClick={() => setEdits(rangeEdits ?? {})}
                        >Reset all ranges</button> }
                    {/* What the dashes mean, wherever they can appear.
                        Shown for the mode rather than for the presence of a
                        carried stretch: the section cannot know whether any row
                        drew one without asking every chart, and a reader meeting
                        a dashed line has no way to find out what it means from
                        the line itself. A legend that is occasionally redundant
                        costs a sentence; an unexplained visual difference in a
                        clinical chart costs the reader's confidence in all of
                        it. */}
                    { carryRange &&
                        <p className="cp-observations-timeline-carry-note">
                            <svg width="26" height="8" viewBox="0 0 26 8" aria-hidden="true">
                                {/* Dash pattern from the stylesheet, not from a
                                    literal here — see --cp-chart-carried-dash. */}
                                <line
                                    x1="0" y1="4" x2="26" y2="4"
                                    stroke="currentColor" strokeWidth="2.5"
                                    strokeLinecap="butt"
                                />
                            </svg>
                            <span>
                                A <b>dashed</b> stretch is graded against a reference interval
                                from an <b>earlier specimen</b>, because the readings under it
                                reported none of their own. The interval was published, but for a
                                different result — so a dashed stretch says how the readings
                                <i> would </i> grade if nothing had changed, not what the
                                laboratory said about them.
                            </span>
                        </p> }
                    {settings}
                </>
            }
            narrative={
                <p>
                    { available.length === 0 ?
                        // Two different nothings. Analytes that are in the record
                        // and cannot be charted are not analytes that were never
                        // found, and telling a reader the patient has no CRP when
                        // the record holds a free-text one is worse than saying
                        // nothing at all.
                        ( unplottable > 0
                            ? `None of the tracked analytes can be charted for this patient; ${unplottable} ${unplottable === 1 ? "is" : "are"} recorded but carry no plottable value.`
                            : "None of the tracked analytes were found for this patient." ) :
                        <>
                            {shown.length} of {available.length} available analyte
                            {available.length === 1 ? "" : "s"} shown.
                            {/* Said only where the section is what did the
                                hiding, so a reader who has unchecked rows
                                themselves is not told the component did it. Both
                                conditions are therefore about the defaults
                                rather than about what is currently on screen.
                                Otherwise a short list of rows against a long
                                list of checkboxes reads as the section having
                                failed to draw the rest. */}
                            { declaresDefaults
                                ? available.some(entry => entry.analyte.defaultShown !== true) &&
                                    <> The rest are listed in the settings and can be added one at
                                    a time.</>
                                : available.length > initiallyShown &&
                                    <> The first {initiallyShown} are checked by default; the rest are
                                    listed in the settings and can be added one at a time.</> }
                            { missing > 0 &&
                                <> {missing} more {missing === 1 ? "is" : "are"} tracked but absent
                                from this record.</> }
                            { unplottable > 0 &&
                                <> {unplottable} {unplottable === 1 ? "is" : "are"} recorded but
                                carry no value that can be plotted.</> }
                        </>
                    }
                </p>
            }
            labels={ shown.length === 0
                ? <div className="cp-observations-timeline-label cp-text-txt-6">Nothing to show</div>
                : shown.map(({ analyte, key, readings }) => {
                    const unit  = readings.unit ?? analyte.unit;
                    const badge = editBadge(edits[key], publishedFor(key), unit ?? null);

                    return (
                    <TimelineChartRowLabel
                        key={key}
                        className="cp-observations-timeline-label"
                        // The unit, and the mark for a range the reader has set
                        // themselves. The values are not repeated here: they are
                        // drawn on the chart at the heights they occupy, which
                        // says more than printing them again would — and the
                        // unit is the patient's own, not the reference table's,
                        // which may differ even where they agree numerically.
                        //
                        // The badge leads the line rather than trailing the name,
                        // so a long analyte name in a narrow label column cannot
                        // push it out of sight — and of everything on this row it
                        // is the part a reader must not miss.
                        //
                        // Left undefined when there is neither, so the second
                        // line is dropped rather than laid out empty.
                        detail={ (badge || unit) &&
                            <>
                                { badge &&
                                    <span className="cp-observations-timeline-adjusted" data-tooltip={badge.full}>
                                        {badge.short}
                                    </span> }
                                {unit}
                            </>
                        }
                    >
                        {analyte.label}
                    </TimelineChartRowLabel>
                    );
                }) }
        >
            { shown.map(({ analyte, key, match, resolve }) => {
                // The reader's own edits, or nothing — deliberately not `?? {}`.
                // An empty object means the same thing to the chart, but it is a
                // different object every render, and the chart holds its resolved
                // readings against this prop: handed a fresh one each frame it
                // would re-resolve every reading on every pointer move.
                const entry = edits[key];

                // Nothing is applied while the two bounds cross. The chart
                // cannot draw an empty interval as anything but a hard edge at a
                // meaningless value, and the panel says so beside the inputs
                // rather than drawing it.
                const override = entry && editsCross(entry, publishedFor(key))
                    ? undefined
                    : entry;

                return (
                <div className="cp-observations-timeline-row" key={key}>
                    <ObservationChart
                        // Above the selection highlight; the row itself stays
                        // behind it so a hovered row cannot erase the selection.
                        className="cp-timeline-chart-row-content"
                        observations={obs}
                        // The analyte's own matcher, held in `chartable` — the
                        // same test that decided this row was worth drawing, so
                        // the chart cannot disagree with the panel about what
                        // belongs in it. Stable across renders, which this prop
                        // requires; see ObservationSelector.
                        code={match}
                        label={analyte.label}
                        height={rowHeight}
                        // Percentages from the chart's shared scale; the chart
                        // wants a fraction of its own width.
                        mapX={time => toPercent(time) / 100}
                        // The row's own chain, not the bare prop: an analyte
                        // declaring a default has it behind whatever the section
                        // resolves, and the chart must be drawing against the
                        // same interval the panel is reporting.
                        referenceRange={resolve}
                        rangeOverride={override}
                        carryRange={carryRange}
                        declaredUnit={analyte.unit}
                        // Every row is told the same id; only the row holding
                        // that reading marks anything, which is what keeps the
                        // section to one selected point.
                        selectedId={selected?.id}
                        // Its own selection, held apart from the one a bar makes:
                        // neither the highlighted range nor a selected medication
                        // is disturbed, so a reader can hold a lab spike and the
                        // drug that preceded it in the sidebar together.
                        onSelectPoint={observation => setSelectedPointId(observationId(observation))}
                    />
                </div>
                );
            }) }
            <TimelineChartHighlight />
        </TimelineChartLayer>
    );
}
