import { useEffect, useRef }    from "react";
import { TimelineChart }        from '../../components/TimelineChart';
import type { TimelineAnalyte } from '../../components/TimelineChart/sections/ObservationsTimeline';
import { useClinicalData }      from '../../library';
import { CodeBlock }            from '../components/CodeBlock';
import bundle                   from '../samplePatientBundle.json';
import { ClinicalPageHeader }   from '../components/ClinicalPageHeader';


/** Vitals this example plots, in the order they are stacked. */
const VITALS: TimelineAnalyte[] = [
    // A panel rather than a single value: ObservationChart infers one series per
    // component, so this row carries systolic and diastolic together.
    //
    // `unit` is the unit, not a description of the row. It used to read
    // "systolic / diastolic, mmHg", which is the sort of thing that looks
    // harmless until it is used for arithmetic: readings are converted into this
    // unit, and nothing converts to a sentence. Which of the two lines is which
    // is the chart's business — it names them from the component codes.
    { code: '55284-4', label: 'Blood pressure', unit: 'mmHg' },

    // Two codes and a keyword, for one measurement. Weight reaches a record as
    // "Body weight" (29463-7) or "Body weight measured" (3141-9) depending on
    // where it came from, and out of a flowsheet extract often with no usable
    // coding at all — all three land in this one row rather than in two rows and
    // a silence.
    {
        code    : ['29463-7', '3141-9'],
        label   : 'Weight',
        unit    : 'kg',
        keywords: ['body weight']
    },

    // A default interval declared on the analyte, for a measurement whose
    // records report none. It sits under anything the readings themselves carry
    // and under any `referenceRange` resolver — and it is quoted in `unit`,
    // which is what the unit check compares against.
    { code: '39156-5', label: 'BMI', unit: 'kg/m2', range: { low: 18.5, high: 25 } },

    // Age bands, in the shape a reference table exports: low age inclusive, high
    // exclusive, one unit per band, and either bound free to be absent where the
    // source quotes only one side. Resolved against the date of each specimen,
    // so a record crossing an edge changes interval part-way along. `range` is
    // still the baseline for ages no band covers — here, an adult.
    {
        code  : '8867-4',
        label : 'Heart rate',
        unit  : '/min',
        ranges: [
            { ageLowYears: 0,  ageHighYears: 1,  unit: '/min', low: 100, high: 160 },
            { ageLowYears: 1,  ageHighYears: 6,  unit: '/min', low: 80,  high: 140 },
            { ageLowYears: 6,  ageHighYears: 12, unit: '/min', low: 70,  high: 120 },
            { ageLowYears: 12, ageHighYears: 18, unit: '/min', low: 60,  high: 100 }
        ],
        range : { low: 60, high: 100 }
    }
];

export function TimelineChartPage() {
    const { loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    // Nothing is pulled out of the record here on purpose. Loading the bundle is
    // the whole setup: every section below reads the patient's data from the
    // same context, so the examples pass no data props at all.

    return (
        <section className="mt-4 max-w-4xl">

            <header className="text-sky-500 uppercase mb-2">TimelineChart</header>
            <p className="cp-text-txt-4 mb-6">
                A two-column grid layout for rendering labeled timeline layers side-by-side.
                Each <code>TimelineChartLayer</code> renders a header column (label + optional legend)
                paired with a content column for custom visualizations.
            </p>

            <ClinicalPageHeader title="Timeline Chart Patient" />

            {/* <hr className="mb-6 cp-border-win-3 cp-border-solid" /> */}

            {/* Props — TimelineChart */}
            <h3 className="mb-3">TimelineChart Props</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Only <code>children</code> is required — the chart is a wrapper that owns the shared
                horizontal scale and the two-column grid every section adopts.
            </p>
            <table className="mb-6 text-sm w-full">
                <thead>
                    <tr className="cp-text-txt-4 text-left">
                        <th className="pb-2 pr-6">Prop</th>
                        <th className="pb-2 pr-6">Type</th>
                        <th className="pb-2 pr-6">Default</th>
                        <th className="pb-2">Description</th>
                    </tr>
                </thead>
                <tbody className="align-top">
                    <tr>
                        <td className="pr-6 py-1"><code>children</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">—</td>
                        <td className="py-1">The sections. Required.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>minX</code> / <code>maxX</code></td>
                        <td className="pr-6 py-1"><code>number</code></td>
                        <td className="pr-6 py-1">last 2 years</td>
                        <td className="py-1">
                            The window the chart <em>opens</em> on, as timestamps. Left out, it shows
                            the last two years — recent enough that a current problem is legible,
                            long enough to show whether it is new.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>limitStart</code> / <code>limitEnd</code></td>
                        <td className="pr-6 py-1"><code>number</code></td>
                        <td className="pr-6 py-1">−100y / +10y</td>
                        <td className="py-1">
                            The furthest the chart can be panned or zoomed — not the same thing as
                            <code>minX</code>/<code>maxX</code>. Zoom caps how <em>wide</em> the range
                            may get, but without these nothing says where it may sit, and enough
                            panning strands the chart on a stretch of calendar holding no data.
                            Widened automatically to cover whatever the sections declare, so an old
                            record is never put out of reach.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">none</td>
                        <td className="py-1">
                            Heading at the left of the toolbar. A node rather than a string, so the
                            heading level stays the caller's to choose — only they know where the
                            chart sits in their document outline.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>ranges</code></td>
                        <td className="pr-6 py-1"><code>TimelineChartRange[]</code></td>
                        <td className="pr-6 py-1">2y / 5y / All</td>
                        <td className="py-1">
                            Preset pills in the toolbar. Pass <code>{'[]'}</code> to drop them.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>ruler</code></td>
                        <td className="pr-6 py-1"><code>boolean</code></td>
                        <td className="pr-6 py-1"><code>true</code></td>
                        <td className="py-1">
                            The vertical rule that follows the pointer across every section. On by
                            default — it is what makes separate sections readable against each other.
                        </td>
                    </tr>
                </tbody>
            </table>

            <h4 className="mb-2">TimelineChartRange</h4>
            <p className="text-sm cp-text-txt-4 mb-4">
                <code>{'{ label, title?, years?, months? }'}</code>. <code>years</code> and
                {' '}<code>months</code> count back from today, which is what “last two years” means —
                a claim about the calendar, not about the record, so a chart whose data stopped
                earlier lands on an empty view. Omit both for “everything on record”, which spans the
                union of the extents the sections declared and is disabled until one has. A pill
                lights up whenever the visible range matches it, so panning or zooming away releases
                it rather than leaving it claiming a window the chart has left.
            </p>

            <h3 className="mb-3">Interaction</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Drag horizontally on any section's content to pan; section headers and the label
                column are not drag targets. A drag never fires the click underneath it, so
                panning across a bar does not change the selection.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                Zooming is on the toolbar, beside the presets, and works about the middle of the
                visible range — the point a reader is looking at when they have no pointer on the
                plot. The chart takes no tab stop and does not zoom on scroll. It used to do both,
                the one buying the other: the wheel zoomed only while the chart had focus, so that
                the page could still be scrolled the rest of the time. A chart tends to fill the
                window, though, and once it had focus there was no way to scroll past it — the
                gesture that would have left the chart was the one it had taken over.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                Hovering a row marks it in both columns at once, and rows within a section are
                separated by a hairline. Both come from <code>TimelineChartLayer</code>, so every
                section gets them without wiring anything up — a section only has to render its
                rows as the layer's direct children.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                The caret beside a section's name collapses it to just that name. Sections open
                expanded, and a collapsed one keeps its sidebar entry, its settings and its share of
                the chart's overall extent — it stops being drawn, not being part of the chart.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                Axis labels and ticks both sit on calendar boundaries — the start of a year, a
                quarter, a month, a day — rather than being spread evenly across the window, so a
                label always names the boundary it stands on and the ticks between two labels mark
                real divisions. Which division is used follows the span and the measured width of the
                labels: thinning jumps from years to five years, or months to quarters, rather than
                dropping to an arbitrary count. A label with no room to be centered on its own date is
                dropped rather than clipped or nudged, since a shifted label would name a boundary it
                is no longer over; the boundary keeps its tick either way.
            </p>

            {/* Props — TimelineChartLayer */}
            <h3 className="mb-3">TimelineChartLayer Props</h3>
            <table className="mb-8 text-sm w-full">
                <thead>
                    <tr className="cp-text-txt-4 text-left">
                        <th className="pb-2 pr-6">Prop</th>
                        <th className="pb-2 pr-6">Type</th>
                        <th className="pb-2 pr-6">Required</th>
                        <th className="pb-2">Description</th>
                    </tr>
                </thead>
                <tbody className="align-top">
                    <tr>
                        <td className="pr-6 py-1"><code>label</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">Text or element shown in the left header column.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>legend</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            A key to what the section's marks mean — which color is which
                            medication class, say. Rendered on its own row beneath the section
                            header, spanning the content column. For explaining data, not for
                            controls: buttons and counts belong in the header, which each
                            section renders itself.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>rows</code></td>
                        <td className="pr-6 py-1"><code>number</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            How many rows of the parent grid this layer occupies (default <code>1</code>).
                            Both columns span the same rows via <code>grid-template-rows: subgrid</code>,
                            so labels and content stay aligned regardless of row height.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>labels</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Left column content — one element per row.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>rowHeight</code></td>
                        <td className="pr-6 py-1"><code>number | string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Minimum height of a single row (default <code>1.6em</code>). Rows grow past this if their content is taller.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>children</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Right column content — one element per row, plus any absolutely positioned overlays.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            Name this section is known by in the sidebar. Falls back to
                            {' '}<code>label</code> when that is a plain string, so it is only needed
                            for a section whose label is a node.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>dataRangeStart</code> / <code>dataRangeEnd</code></td>
                        <td className="pr-6 py-1"><code>number</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            This section's own extent. The chart unions these to decide what
                            “everything on record” means, so it is what the <code>All</code> preset
                            spans and what the pan limits widen to cover. Leave them out for a
                            section with nothing to contribute — it is then left out of the total
                            rather than collapsing it toward zero. Declare the extent of everything
                            the section <em>has</em>, not of what it currently draws, or hiding a row
                            would quietly redefine the chart's range for every other section.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>settings</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            Section-specific controls. Supplying them puts a gear in the section
                            header that opens this content in the sidebar.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>narrative</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            Prose explaining what the section is showing. Sidebar only.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>selection</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            What the current selection means to this section. Sidebar only. Derive it
                            from the chart's selection rather than setting it when a mark is clicked,
                            so it stays right however the selection was made — including by another
                            section.
                        </td>
                    </tr>
                </tbody>
            </table>

            <h4 className="mb-2">Companions</h4>
            <p className="text-sm cp-text-txt-4 mb-4">
                <code>TimelineChartRowLabel</code> names one row, with its unit on a second line
                beneath. Use it rather than writing the two lines by hand: the layer styles label
                cells as right-aligned flex rows, and a stacked label has to out-specify that rule or
                it ends up laid out on the wrong axis.
            </p>
            <p className="text-sm cp-text-txt-4 mb-8">
                <code>TimelineChartHighlight</code> draws the selected range over a section, and is
                rendered by the section as a child of the layer. <code>TimelineChartAxis</code> and
                the pointer ruler are placed by the chart itself, so neither needs to be mounted by
                hand. A row that must sit above the selection wash — an embedded chart, say — takes
                the <code>cp-timeline-chart-row-content</code> class; put it on the element inside
                the row rather than the row, or the row's hover background rises with it and paints
                over the selection.
            </p>

            <h4 className="mb-2">What the chart expects from the app</h4>
            <p className="text-sm cp-text-txt-4 mb-8">
                Hovering a bar or a reading shows a tooltip, but only if a single
                {' '}<code>&lt;Tooltip /&gt;</code> is mounted somewhere in the app — near the root is
                the usual place. Marks do not render their own: they carry a <code>data-tooltip</code>
                {' '}attribute and that one component listens for them, which is what keeps a chart of
                a few hundred bars from mounting a few hundred listeners. Without it nothing errors
                and nothing appears, so it is worth checking first when tooltips seem to be missing.
                The library's stylesheet — <code>clinical-primitives/styles.css</code> — has to be
                imported for the same reason.
            </p>

            <h4 className="mb-2">Where sections get their data</h4>
            <p className="text-sm cp-text-txt-4 mb-8">
                The ready-made sections — <code>MedicationsTimeline</code>,
                {' '}<code>ObservationsTimeline</code> — read the patient's own record from
                {' '}<code>ClinicalDataProvider</code>, so inside a loaded chart they take no data
                props at all. <code>ObservationsTimeline</code> likewise takes the loaded patient
                for the age and sex its reference bands are keyed on, rather than having to be told
                twice who is being looked at. Passing data explicitly still works and still wins,
                which is what a filtered subset, a side-by-side comparison or a test fixture needs
                — but it is the exception, not the setup step. The example below passes nothing.
            </p>

            {/* Example — the generic section, unfiltered */}
            <h3 className="mb-3">Every medication, plus vitals</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                The sample bundle through <code>MedicationsTimeline</code> with no classifier, so
                nothing is filtered by disease: one row per drug, colored from the fallback palette
                purely to tell adjacent rows apart. Every course of a drug shares its row, so a
                medication started, stopped and restarted reads as one thing with gaps rather than
                as several rows with identical labels.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                It opens on active medications only — a full prescribing history is mostly drugs the
                patient is no longer on. Clear that checkbox in the sidebar to see the rest, which
                are drawn back rather than hidden so a stopped course still reads as the same drug
                as the live ones.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                This particular record shows both provisional rules at work. Its active medications
                are marked <code>active</code> but were authored in 2002–2006 and record no end
                date, so they are drawn as running up to now — an assumption, not data. The stopped
                ones carry a single date and no period, so they render as instants: zero-width bars
                that keep a minimum hit area rather than vanishing.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                The vitals beneath are <code>ObservationsTimeline</code> handed a list of four
                analytes and nothing else. Everything past that list — the row toggles, the counts
                of what the record does and does not hold, the reference-range editor under each
                row — comes with the component. A disease-specific panel is the same component
                given a longer list, with age-banded intervals on the analytes themselves.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                An analyte may name several codes and a set of keywords, as Weight does here. One
                measurement frequently reaches a record under more than one code, and out of a
                flowsheet extract under none — left to the codes alone it would appear as two
                half-empty rows and a gap. Pass <code>showAbsent={'{false}'}</code> alongside to
                use a list purely for that gathering, without the greyed-out rows and absence counts
                that make a declared panel a clinical statement.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                Each row is one <code>ObservationChart</code> given the chart's scale through
                {' '}<code>mapX</code>, which is the point of stacking them: a weight trend sits
                directly under the medications covering the same dates, on the same dates. The blood
                pressure row plots two series from one panel, since <code>ObservationChart</code>
                {' '}infers a series per component — and it is the one row with no range editor,
                because a single pair of bounds cannot describe both systolic and diastolic.
            </p>
            <p className="text-sm cp-text-txt-4 mb-4">
                Clicking anywhere on a row selects the reading nearest the pointer — the same one
                the hover marker follows — and opens it in the sidebar, resource and all. One
                reading is selected at a time, held apart from the selected medication rather than
                competing with it: a bar's selection is the highlighted range, while a reading is an
                instant and selecting one leaves the range, and any selected bar, exactly where they
                were. Both panels can be open at once, which is the point of stacking the sections.
                Clicking empty chart drops everything.
            </p>
            <div className="mb-4">
                <TimelineChart title={<h4>Medications &amp; Vitals</h4>}>
                    <TimelineChart.MedicationsTimeline />
                    <TimelineChart.ObservationsTimeline analytes={VITALS} label="Vitals" title="Vitals" />
                </TimelineChart>
            </div>
            <CodeBlock language="tsx">{`// Sections read the patient's data from ClinicalDataProvider, so a chart
// over the loaded record needs no data props at all.
<TimelineChart title={<h4>Medications & Vitals</h4>}>
    <TimelineChart.MedicationsTimeline />
    <TimelineChart.ObservationsTimeline analytes={VITALS} label="Vitals" title="Vitals" />
</TimelineChart>`}</CodeBlock>

        </section>
    );
}
