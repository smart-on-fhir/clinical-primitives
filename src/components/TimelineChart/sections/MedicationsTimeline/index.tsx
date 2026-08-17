import { useMemo, useState } from "react";
import { BarChartTimeline, type TimelineBarRow } from "../BarChartTimeline";
import { getMedicationName, getMedicationPeriod } from "../../../../lib/Medication";
import type { TimelineChartLayerProps } from "../..";
import { useTimelineChartContext } from "../../TimelineChartContext";
import { useClinicalData } from "../../../../fhir/context";
import { MedicationDetail } from "./MedicationDetail";
import { CheckBox } from "../../../CheckBox";
import {
    ACTIVE_STATUSES,
    classifyMedication,
    ONGOING_STATUSES,
    type MedicationClassification,
    type MedicationClassifier,
    type MedicationLegendEntry,
    type TimelineMedication
} from "./classify";
import { medicationTooltip } from "./tooltip";

export type {
    MedicationClassification,
    MedicationClassifier,
    MedicationLegendEntry,
    TimelineMedication
} from "./classify";
export { classifyMedication } from "./classify";

/**
 * Fallback colors, cycled across rows the classifier said nothing about. Purely
 * to tell adjacent rows apart — none of these carry clinical meaning.
 */
const BAR_COLORS = ["blue", "red", "yellow", "green", "teal", "purple", "amber"];

/**
 * A timeline section showing when the patient was on each medication. Takes FHIR
 * resources and renders them through the domain-agnostic
 * {@link BarChartTimeline}, which stays free of FHIR — all medication knowledge
 * lives here and in `lib/Medication.ts`.
 *
 * What to include, how to group, name and color it is decided by a single
 * {@link MedicationClassifier}, so a deployment with its own drug classes
 * replaces one function rather than assembling several callbacks that could
 * disagree about what a medication is.
 *
 * Two rules remain provisional:
 *
 * - A medication whose status is ongoing but which records no end date is drawn
 *   as running up to now. That is an assumption, not data.
 * - A medication with no period at all is drawn as an instant: a zero-width bar
 *   at its authored date. Most of a typical Synthea bundle looks like this.
 */
export function MedicationsTimeline({
    medications,
    label = "Medications",
    legend,
    settings,
    classify
}: {
    /**
     * The medications to plot. Left out, the section takes the patient's own
     * from {@link useClinicalData} — a clinical component in a loaded chart
     * should not have to be handed the record it is already sitting in.
     *
     * Pass them to plot something other than what is loaded: a filtered subset,
     * a comparison, or fixtures in a test.
     */
    medications?: TimelineMedication[],
    label?: TimelineChartLayerProps['label'],

    /**
     * A key to what the bars mean. Pass a function to build it from the
     * categories the classifier actually produced — that way the legend can
     * never name a class the chart is not showing.
     */
    legend?: TimelineChartLayerProps['legend'] | ((categories: MedicationLegendEntry[]) => TimelineChartLayerProps['legend']),

    /** Extra content appended below the section's own settings. */
    settings?: TimelineChartLayerProps['settings'],

    /**
     * Adjusts what happens to each medication — whether to show it, and how to
     * name, group, color and decorate it.
     *
     * {@link classifyMedication} has already run by the time this is called and
     * its result arrives as the first argument, so most classifiers are one
     * line: `(base, med) => base && { ...base, color: colorFor(med) }`. Left
     * out, that default stands on its own.
     */
    classify?: MedicationClassifier
}) {
    const { selectedId } = useTimelineChartContext();
    const { resources }  = useClinicalData();

    // Both resource types, because a timeline of "what the patient was on" is
    // not answered by orders alone — an administration is the record that it
    // actually happened. `TimelineMedication` covers both, and the classifier
    // is handed whichever it finds.
    //
    // Memoized so the fallback is a stable array: the grouping below is keyed
    // on this, and a fresh array each render would defeat it.
    const fromContext = useMemo(() => [
        ...((resources.MedicationRequest ?? []) as unknown as TimelineMedication[]),
        ...((resources.MedicationAdministration ?? []) as unknown as TimelineMedication[])
    ], [resources.MedicationRequest, resources.MedicationAdministration]);

    const meds = medications ?? fromContext;

    // On by default: a patient's full prescribing history is mostly medications
    // they are no longer on, and showing all of it buries the current picture.
    // The classifier is still told this as `includeInactive`, so its contract
    // stays a plain "should I let non-active ones through" — only the control is
    // phrased the other way round.
    const [onlyActive, setOnlyActive] = useState(true);

    // Rows the user has unchecked, keyed the same way rows are grouped. Hidden
    // rather than dropped: they stay in the settings list so their checkbox can
    // be found again, and stay in the counts so the narrative keeps describing
    // the record rather than the current view of it.
    //
    // Keyed by group rather than by position, so a row that moves — a new
    // earlier course arriving and resorting the section — keeps its setting
    // instead of handing it to whichever drug took its place.
    const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());

    const toggleRow = (key: string) => setHiddenRows(current => {
        const next = new Set(current);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });

    // Fixed for the lifetime of the section. An ongoing medication's bar ends at
    // "now", and if that were re-read every render the bar's interval would
    // change between the click that selects it and the re-render that follows —
    // so the selection would never match and the bar could never look selected.
    const now = useMemo(() => Date.now(), []);

    // Every course of the same drug shares a row, so a medication started,
    // stopped and restarted reads as one thing with gaps rather than as three
    // unrelated rows with identical labels. Each interval keeps a reference back
    // to the resource it came from, so clicking one bar shows that course rather
    // than the whole row.
    type Interval = {
        x1: number,
        x2: number,
        med: TimelineMedication,
        classification: MedicationClassification
    };

    type Group = {
        classification: MedicationClassification,
        fullNames: Set<string>,
        intervals: Interval[]
    };

    // Grouping the record is expensive and has nothing to do with the visible
    // range, so it is held across pans and zooms.
    //
    // This section re-renders on every context change — it reads `selectedId` —
    // and a drag pushes one of those per pointer move. Rebuilt each time, this
    // walked every medication to classify it, resolve its period and read its
    // names, then built a Markdown tooltip per bar. Each tooltip formats dates
    // through `toLocaleDateString`/`toLocaleTimeString`, which construct a
    // formatter internally on every call — so a chart with many medications was
    // running hundreds of locale formats per frame while the pointer moved.
    const {
        groups,
        medicationsById,
        categories,
        includedCount
    } = useMemo(() => {
        const groups = new Map<string, Group>();

        // Lets the sidebar answer "what is selected" by looking the id up,
        // rather than the chart having to remember what was clicked.
        const medicationsById = new Map<string, TimelineMedication>();

        // Categories that made it onto the chart, in the order they first
        // appeared. Collected while grouping rather than derived afterwards, so
        // the legend is built from exactly what was drawn.
        const categories = new Map<string, MedicationLegendEntry>();

        let includedCount = 0;

    for (const med of meds) {
        const options = { includeInactive: !onlyActive };

        // The default runs for every medication, including ones it would drop:
        // a classifier that wants to include an inactive course gets to see it,
        // and gets told what the default decided rather than having to re-derive it.
        const base = classifyMedication(med, options);

        const classification = classify ? classify(base, med, options) : base;

        if (!classification) {
            continue;
        }

        includedCount++;

        const period = getMedicationPeriod(med);

        // A medication with no usable date cannot be placed on a timeline at all.
        if (!period) {
            continue;
        }

        // Recorded only after the checks above, so a class whose every member was
        // dropped never appears in the legend.
        if (classification.category && !categories.has(classification.category.key)) {
            categories.set(classification.category.key, {
                ...classification.category,
                color: classification.color
            });
        }

        const name = classification.name ?? "Unnamed medication";
        const key  = classification.group ?? name;

        let group = groups.get(key);

        if (!group) {
            // The first member's classification supplies the row's label and
            // order. Per-medication fields — color, className — are read per bar
            // instead, so a group whose members disagree renders the difference
            // rather than hiding it behind whoever arrived first.
            group = { classification, fullNames: new Set(), intervals: [] };
            groups.set(key, group);
        }

        const fullName = getMedicationName(med);

        if (fullName) {
            group.fullNames.add(fullName);
        }

        if (med.id) {
            medicationsById.set(`${med.resourceType}/${med.id}`, med);
        }

        group.intervals.push({
            x1: period.start,
            x2: period.end ?? (ONGOING_STATUSES.has(med.status ?? "") ? now : period.start),
            med,
            classification
        });
    }

        return { groups, medicationsById, categories, includedCount };

    // `classify` belongs here: a caller passing an inline arrow re-groups on
    // every render and gets none of this back. Both classifiers in the library
    // are module constants for that reason.
    }, [meds, classify, onlyActive, now]);

    // Derived from the chart's selection rather than set when a bar is clicked,
    // so the panel is right however the selection was made — and empties itself
    // when another section takes the selection over.
    const selectedMedication = selectedId ? medicationsById.get(selectedId) : undefined;

    const hiddenCount = meds.length - includedCount;

    // Every course the section could draw, checked or not — the section's true
    // extent, which the chart's "all" range is built from.
    const allIntervals = useMemo(
        () => [...groups.values()].flatMap(group => group.intervals),
        [groups]
    );

    // Every row the section could draw, in the order it draws them.
    const ordered = useMemo(() => [...groups.entries()]
        .map(([key, group]) => ({
            key,
            group,
            earliest: Math.min(...group.intervals.map(i => i.x1))
        }))
        .sort((a, b) =>
            // Classifier-supplied order wins; everything else falls back to
            // chronology, and unordered rows sort after ordered ones.
            (a.group.classification.order ?? Infinity) - (b.group.classification.order ?? Infinity) ||
            a.earliest - b.earliest
        )
        // Palette position is fixed here, over every row rather than over the
        // visible ones. Numbered after the filter instead, unchecking one row
        // would renumber every row below it and change the color of drugs the
        // user did not touch — turning a checkbox into a recolor of the chart.
        .map((entry, index) => ({ ...entry, index })),
    [groups]);

    // The settings list, by name rather than in chart order.
    //
    // This list is used to find a drug, not to read the record: the chart is
    // where the courses are read, and it is ordered by the classifier and then by
    // when treatment started, which is what makes it legible. Neither ordering
    // helps someone looking for one name among forty.
    //
    // A copy, because the order the rows are drawn in — and with it each row's
    // color, which is fixed by position — comes from `ordered` itself.
    const listed = useMemo(() => [...ordered].sort((a, b) =>
        (a.group.classification.name ?? a.key).localeCompare(b.group.classification.name ?? b.key)
    ), [ordered]);

    // Held across pans for the same reason the grouping is, and more urgently:
    // this is where each bar's tooltip is built, and formatting a course's
    // dates is the most expensive thing the section does per bar.
    const rows: TimelineBarRow[] = useMemo(() => ordered
        .filter(({ key }) => !hiddenRows.has(key))
        .map(({ key, group, index }) => {
            const { classification } = group;

            // Row labels use the short name to stay legible in a narrow column.
            // The full prescribed products carry strength and form, which are
            // clinically meaningful, so they are kept for the tooltip and shown
            // in full in the sidebar detail view.
            const title = [...group.fullNames].join("\n");
            const name  = classification.name ?? key;

            // Only reached when the classifier offered no color: one palette
            // entry per row, so every course of a drug looks like that drug.
            const fallbackClassName = `cp-fill-${BAR_COLORS[index % BAR_COLORS.length]}`;

            return {
                label: classification.label ?? <span title={title || undefined}>{name}</span>,
                bars: group.intervals
                    .sort((a, b) => a.x1 - b.x1)
                    .map(({ x1, x2, med, classification: barClassification }) => ({
                        x1,
                        x2,
                        color: barClassification.color,
                        // Drawn back rather than recolored, so a stopped course
                        // still reads as the same drug as the active one above
                        // it — only less present. Judged from the status rather
                        // than from the checkbox, so it is equally right for a
                        // custom classifier that lets non-active medications
                        // through on its own terms.
                        //
                        // Appended to whatever the classifier asked for instead
                        // of replacing it: a class carrying a drug's identity
                        // has to survive the course being over.
                        className: [
                            barClassification.className ??
                                (barClassification.color ? undefined : fallbackClassName),
                            ACTIVE_STATUSES.has(med.status ?? "") ? undefined : "cp-timeline-bar-muted"
                        ].filter(Boolean).join(" ") || undefined,
                        // Per course, not per row: a drug taken three times can
                        // differ in dose and dates each time, and a row-level
                        // summary would describe none of them accurately.
                        tooltip: medicationTooltip(med),
                        // Keyed on the resource, so selection survives the list
                        // being re-fetched or reordered.
                        id: med.id ? `${med.resourceType}/${med.id}` : undefined
                    }))
            };
        }),
    [ordered, hiddenRows]);

    return (
        <BarChartTimeline
            label={label}
            legend={typeof legend === "function" ? legend([...categories.values()]) : legend}
            // Spans every row, not the checked ones. Unchecking a row is a
            // change to the view, and it should not shrink what the chart
            // considers the full extent of the record — least of all for the
            // other sections sharing that range.
            dataRangeStart={allIntervals.length ? Math.min(...allIntervals.map(i => i.x1)) : undefined}
            dataRangeEnd={allIntervals.length ? Math.max(...allIntervals.map(i => i.x2)) : undefined}
            settings={
                <>
                    <label className="cp-timeline-setting">
                        <CheckBox
                            checked={onlyActive}
                            onChange={e => setOnlyActive(e.target.checked)}
                        />
                        <span>
                            Only show active medications
                            {/* Naming the count makes it clear something is being
                                withheld, rather than the patient simply having
                                few medications. */}
                            { onlyActive && hiddenCount > 0 && <span className="cp-text-txt-6"> (-{hiddenCount})</span> }
                        </span>
                    </label>

                    { listed.length > 0 && <hr className="cp-border-win-2 cp-mb-3" /> }
                    
                    {/* One entry per row the section drew, so the panel is
                        always a list of exactly what is on the chart — no
                        registration step, and no way for it to name a drug that
                        is not there. Below the status filter because that
                        filter decides which rows exist at all: unchecking it
                        lengthens this list rather than changing what it means. */}
                    { listed.map(({ key, group }) => (
                        <label className="cp-timeline-setting" key={key}>
                            <CheckBox
                                checked={!hiddenRows.has(key)}
                                onChange={() => toggleRow(key)}
                            />
                            <span>
                                {group.classification.name ?? key}
                                {/* Courses, not medications: a drug prescribed
                                    three times is one row with three bars, and
                                    the count explains why the row has gaps. */}
                                <span className="cp-text-txt-6"> ({group.intervals.length})</span>
                            </span>
                        </label>
                    )) }

                    {settings}
                </>
            }
            narrative={
                <p>
                    {/* Counted over every row rather than the visible ones: this
                        describes the record, and a reader who has unchecked half
                        the list still needs to know what the other half was. */}
                    { ordered.length === 0 ?
                        "No medications to show." :
                        <>
                            {includedCount} medication{includedCount === 1 ? "" : "s"} across{" "}
                            {ordered.length} row{ordered.length === 1 ? "" : "s"}
                            { categories.size > 0 && <>, in {categories.size} class{categories.size === 1 ? "" : "es"}</> }
                            .
                            { ordered.length - rows.length > 0 &&
                                <> {ordered.length - rows.length} row
                                {ordered.length - rows.length === 1 ? " is" : "s are"} unchecked.</> }
                            { hiddenCount > 0 && onlyActive &&
                                <> {hiddenCount} non-active medication{hiddenCount === 1 ? " is" : "s are"} hidden.</> }
                        </>
                    }
                </p>
            }
            selection={
                selectedMedication ?
                    <MedicationDetail medication={selectedMedication} /> :
                    undefined
            }
            rows={rows}
        />
    );
}
