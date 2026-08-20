import {
    Children, cloneElement, isValidElement, useCallback, useEffect, useMemo,
    useRef, useState, type ReactElement, type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { TimelineContextProvider, useSection, useTimelineChartContext } from "./TimelineChartContext";
import { usePan }              from "./usePan";
import { useSidebarResize }    from "./useSidebarResize";
import { zoomedRange }         from "./zoom";
import { Collapse }            from "../Collapse";
import {
    ChevronDown, Cog, PanelRightClose, PanelRightOpen, SquareDashedMousePointer,
    ZoomIn, ZoomOut
} from "lucide-react";
import "./TimelineChart.scss";

import { MedicationsTimeline }  from "./sections/MedicationsTimeline"
import { ObservationsTimeline } from "./sections/ObservationsTimeline"
import { BarChartTimeline } from "./sections/BarChartTimeline";


/**
 * A window the toolbar offers as a pill.
 *
 * `years` and `months` are counted back from today, which is what "last two
 * years" says — a claim about the calendar, not about the record. A chart whose
 * data stopped before then will land on an empty view, and that is the honest
 * answer: the reading is that there has been nothing recently.
 *
 * Omit both for "everything on record", which spans the union of the extents
 * sections have registered instead.
 */
export interface TimelineChartRange {
    /** Shown on the pill. Keep it short — these sit in a row. */
    label: React.ReactNode;

    /** Accessible name and tooltip, for a label too terse to stand alone. */
    title?: string;

    years?: number;
    months?: number;
}

const DEFAULT_RANGES: TimelineChartRange[] = [
    { label: "2y",  title: "Last 2 years", years: 2 },
    { label: "5y",  title: "Last 5 years", years: 5 },
    { label: "10y", title: "Last 10 years", years: 10 },
    { label: "All", title: "Everything on record" }
];

/**
 * How far the visible range may sit from a preset and still count as showing it,
 * as a fraction of the preset's own span.
 *
 * A tolerance rather than an equality test because neither end is stable: `now`
 * advances between the click and every later render, and a zoom lands on
 * arbitrary fractions. Relative to the span so it means the same thing for a
 * two-year window and a forty-year one.
 */
const RANGE_MATCH_TOLERANCE = 0.01;

/**
 * The window a preset selects, or `null` when it cannot name one — "all" on a
 * chart whose sections have declared no extent, which is the state before any
 * data has loaded.
 */
function rangeBounds(
    range: TimelineChartRange,
    now: number,
    dataRangeStart?: number,
    dataRangeEnd?: number
): [number, number] | null {
    if (range.years === undefined && range.months === undefined) {
        return dataRangeStart !== undefined && dataRangeEnd !== undefined && dataRangeEnd > dataRangeStart
            ? [dataRangeStart, dataRangeEnd]
            : null;
    }

    // Calendar arithmetic, as the chart's own default window uses: subtracting
    // a fixed day count drifts by a day for every leap year in the span, so the
    // window would not land on the date it started from.
    const start = new Date(now);

    if (range.years  !== undefined) start.setFullYear(start.getFullYear() - range.years);
    if (range.months !== undefined) start.setMonth(start.getMonth() - range.months);

    return [start.getTime(), now];
}

/** Whether the chart is currently showing this window, within {@link RANGE_MATCH_TOLERANCE}. */
function rangeMatches([start, end]: [number, number], visibleStart: number, visibleEnd: number): boolean {
    const span = end - start;

    if (span <= 0) {
        return false;
    }

    const slack = span * RANGE_MATCH_TOLERANCE;

    return Math.abs(start - visibleStart) <= slack
        && Math.abs(end   - visibleEnd)   <= slack;
}

/**
 * Pills that jump the chart to a preset span.
 *
 * A pill reads as active from the chart's own visible range rather than from
 * which one was clicked last, so panning or zooming away releases it. Otherwise
 * the row would keep claiming a window the chart had long since left.
 */
function TimelineChartRanges({ ranges }: { ranges: TimelineChartRange[] })
{
    const {
        visibleRangeStart,
        visibleRangeEnd,
        dataRangeStart,
        dataRangeEnd,
        setVisibleRange
    } = useTimelineChartContext();

    // Read once for the whole row, so no two pills can disagree about now.
    const now = Date.now();

    // Resolved once and kept, because two things need them: which pill reads as
    // selected, and where a click takes the chart. Computed separately those
    // could disagree by a millisecond of `now`.
    const presets = ranges.map(range => ({
        range,
        bounds: rangeBounds(range, now, dataRangeStart, dataRangeEnd)
    }));

    // The selected pill is whichever window the chart is actually showing, not
    // whichever was clicked last — so panning or zooming away releases it. No
    // match is the ordinary state, and `-1` matches no option's value, which is
    // how the group renders with nothing selected.
    const selected = presets.findIndex(({ bounds }) =>
        bounds && rangeMatches(bounds, visibleRangeStart, visibleRangeEnd));

    return (
        <div className="cp-timeline-chart-ranges" role="group" aria-label="Visible range">
            { presets.map(({ range, bounds }, index) => (
                <button
                    disabled={!bounds}
                    data-tooltip={range.title}
                    className={"cp-timeline-chart-ranges-btn" + (selected === index ? ' active' : '')}
                    onClick={() => { if (bounds) setVisibleRange(bounds[0], bounds[1]); }}
                >{range.label}</button>
            )) }
        </div>
    );
}

/**
 * How much one press changes the visible span.
 *
 * Enough to be worth a click — a step that barely moves takes a dozen presses to
 * cross a decade — and small enough that a reader can still land near a window
 * they wanted rather than overshooting it every time.
 */
const ZOOM_STEP = 1.6;

/**
 * Buttons that widen and tighten the visible range about its middle.
 *
 * The middle rather than today, or the edge a preset would fix: this is the one
 * point on screen a reader is looking at when they have no pointer on the plot,
 * and holding it still means what is being read stays where it is. Zooming from
 * an edge would slide the chart out from under them.
 *
 * A `RadioButton` for its segmented look beside the presets, but these are
 * actions rather than a selection — neither is ever the current one, and `value`
 * deliberately matches no option.
 */
function TimelineChartZoom()
{
    const { visibleRangeStart, visibleRangeEnd, setVisibleRange } = useTimelineChartContext();

    const span    = visibleRangeEnd - visibleRangeStart;
    const tighter = zoomedRange(visibleRangeStart, visibleRangeEnd, 1 / ZOOM_STEP);
    const wider   = zoomedRange(visibleRangeStart, visibleRangeEnd, ZOOM_STEP);

    // Disabled at the ends rather than left to press with no effect. Asked of the
    // arithmetic rather than compared against the limits directly, so a button
    // greys out exactly when the wheel stops moving too.
    const canTighten = !!tighter && tighter[1] - tighter[0] < span;
    const canWiden   = !!wider   && wider[1]   - wider[0]   > span;

    return (
        <div className="cp-timeline-chart-zoom" role="group" aria-label="Zoom">
            <button
                disabled={!canWiden}
                data-tooltip={"**Zoom out**\nShow a longer span"}
                className="cp-timeline-chart-ranges-btn"
                onClick={() => {
                    if (wider) setVisibleRange(wider[0], wider[1])
                }}
            ><ZoomOut /></button>
            <button
                disabled={!canTighten}
                data-tooltip={"**Zoom in**\nShow a shorter span"}
                className="cp-timeline-chart-ranges-btn"
                onClick={() => {
                    if (tighter) setVisibleRange(tighter[0], tighter[1])
                }}
            ><ZoomIn /></button>
        </div>
    );
}


// TimelineChart ---------------------------------------------------------------

interface TimelineChartProps {
    children: React.ReactNode;
    minX?: number;
    maxX?: number;

    /**
     * The furthest the chart can be panned or zoomed, as timestamps — not to be
     * confused with `minX`/`maxX`, which set the window it *opens* on.
     *
     * Defaults to a century back and a decade forward. Zoom caps how wide the
     * visible range may get, but without these there is nothing to say where it
     * may sit, and enough panning leaves the chart on a stretch of calendar
     * nobody has any data for.
     *
     * Widened automatically to cover whatever the sections declare, so a record
     * older than the default is still reachable.
     */
    limitStart?: number;
    limitEnd?: number;

    /**
     * Heading for the chart, shown at the left of the toolbar. A node rather
     * than a string so the caller chooses the heading level — only they know
     * where this chart sits in their document outline.
     */
    title?: React.ReactNode;

    /**
     * Preset spans offered as pills in the toolbar. Pass `[]` to drop them,
     * for a chart where jumping the range makes no sense.
     */
    ranges?: TimelineChartRange[];

    /**
     * Draw a vertical rule following the pointer across every layer. On by
     * default — it is what makes separate sections readable against each other.
     */
    ruler?: boolean;
}

export function TimelineChart({ children, minX, maxX, title, ranges, ruler, limitStart, limitEnd }: TimelineChartProps)
{
    return (
        // The limits belong to the provider, not the implementation: it owns
        // the visible range, and clamping there is what makes every route to a
        // range change — pan, zoom, keyboard, presets — obey them.
        <TimelineContextProvider limitStart={limitStart} limitEnd={limitEnd}>
            <TimelineChartImplementation
                children={children}
                minX={minX}
                maxX={maxX}
                title={title}
                ranges={ranges}
                ruler={ruler}
            />
        </TimelineContextProvider>
    )
}

TimelineChart.MedicationsTimeline  = MedicationsTimeline;
TimelineChart.ObservationsTimeline = ObservationsTimeline;
TimelineChart.BarChartTimeline     = BarChartTimeline;

function TimelineChartImplementation({ children, minX, maxX, title, ranges = DEFAULT_RANGES, ruler = true }: TimelineChartProps)
{
    const { setVisibleRangeStart, setVisibleRangeEnd, sidebarOpen, setRulerPercent, sections } = useTimelineChartContext();

    // The grid whose second track the sidebar occupies, so the resize can write
    // the new width to the element that owns the track.
    const rootRef = useRef<HTMLDivElement>(null);

    const { width: sidebarWidth, handleProps } = useSidebarResize(rootRef);

    // With every section folded up to its header there is no plot left, and an
    // axis under nothing is a row of dates measuring empty space. Sections that
    // have not registered yet are not "all collapsed": an empty chart keeps its
    // axis, which is what makes it read as a chart waiting for data.
    const plotted = sections.length === 0 || sections.some(section => !section.collapsed);

    /**
     * Tracks the pointer for the ruler every layer draws.
     *
     * Stored as a percentage of the plotting column, not as a pixel offset:
     * each layer positions its own segment inside its own content box, and a
     * percentage is the only form that means the same thing in all of them.
     *
     * Resolved from the element under the pointer rather than from the first
     * content column in the grid. The columns all share one geometry, so any of
     * them yields the same percentage — but only the hovered one answers the
     * question that actually matters, which is whether the pointer is over a
     * plot at all. Testing the shared box instead accepts everything stacked
     * above and below it at the same horizontal position: the toolbar, section
     * headers, legends, the axis, and the gaps between sections.
     */
    function onPointerMove(event: React.PointerEvent<HTMLElement>) {
        const content = event.target instanceof Element
            ? event.target.closest(".cp-timeline-chart-layer-y-content")
            : null;

        if (!content) {
            setRulerPercent(undefined);
            return;
        }

        const rect = content.getBoundingClientRect();

        // Inside the column by construction; the width guard is only against a
        // box that has not been laid out yet, which would divide by zero.
        setRulerPercent(
            rect.width > 0
                ? ((event.clientX - rect.left) / rect.width) * 100
                : undefined
        );
    }

    useEffect(() => {
        if (minX !== undefined) {
            setVisibleRangeStart(minX);
        }
    }, [minX]);

    useEffect(() => {
        if (maxX !== undefined) {
            setVisibleRangeEnd(maxX);
        }
    }, [maxX]);

    return (
        // Not focusable, and so with no key handling of its own.
        //
        // It used to take a tab stop, which bought scroll-to-zoom — the wheel
        // only zoomed while the chart had focus, so that the page could still be
        // scrolled the rest of the time. In practice a chart fills the window,
        // and once it had focus there was no way to scroll past it: the gesture
        // that would have left the chart was the one it had taken over. Zooming
        // is on the toolbar instead, where it needs no focus and no chord.
        //
        // The group role stays. It has nothing to do with focus — it is what
        // gives the whole chart one name in the accessibility tree instead of
        // a loose pile of sections.
        <div
            ref={rootRef}
            className={`cp-timeline-chart${sidebarOpen ? " cp-timeline-chart-with-sidebar" : ""}`}
            role="group"
            aria-label="Timeline"
            // Re-stated on every render so React's value wins after a drag,
            // which wrote the same property straight to the node.
            style={{ "--cp-timeline-sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
            onPointerMove={ruler ? onPointerMove : undefined}
            onPointerLeave={ruler ? () => setRulerPercent(undefined) : undefined}
        >
            <div className="cp-timeline-chart-main">
                <div className="cp-timeline-chart-toolbar">
                    <div className="cp-timeline-chart-toolbar-left">
                        { title && <div className="cp-timeline-chart-title">{title}</div> }
                        { ranges.length > 0 && <>
                            <TimelineChartRanges ranges={ranges} />
                            <div className="cp-fill-win-2" style={{ height: '1em', width: 1, margin: '0 var(--cp-space-3)' }} />
                        </> }
                        <TimelineChartZoom />
                        <div className="cp-fill-win-2" style={{ height: '1em', width: 1, margin: '0 var(--cp-space-3)' }} />
                    </div>
                    <div className="cp-timeline-chart-toolbar-right">
                        <TimelineChartSidebarToggle />
                    </div>
                </div>
                <div className="cp-timeline-chart-grid">
                    {children}
                    { plotted && <TimelineChartAxis /> }
                </div>
            </div>
            {/* Always mounted, so opening and closing can be animated. It is the
                grid column that collapses, not the element. */}
            <TimelineChartSidebar handleProps={handleProps} />
        </div>
    )
}

function TimelineChartSidebarToggle()
{
    const { sidebarOpen, setSidebarPanel } = useTimelineChartContext();

    return (
        <button
            onClick={() => setSidebarPanel(sidebarOpen ? null : "overview")}
            title={sidebarOpen ? "Hide details" : "Show details"}
            aria-expanded={sidebarOpen}
        >
            { sidebarOpen ?
                <PanelRightClose style={{ display: 'block' }} /> :
                <PanelRightOpen style={{ display: 'block' }} /> }
        </button>
    )
}

/**
 * A row label carrying a second line — a unit, a scale, a count — beneath the
 * name. For a section whose rows are charts rather than bars, that second line
 * is usually the only place the unit can appear at all: an embedded
 * `ObservationChart` given a shared scale draws no header of its own.
 *
 * Worth a component rather than markup each section repeats, because stacking
 * the two lines is not simply a matter of writing them one above the other. The
 * layer styles every label cell as a right-aligned flex row, and that rule —
 * `.cp-timeline-chart-layer-y-axis > div` — outranks a lone class. Left
 * unbeaten it reinterprets both flex properties once the direction turns
 * vertical: `justify-content: flex-end` stops meaning "right" and starts
 * meaning "bottom", `align-items: center` stops meaning "middle" and starts
 * meaning "horizontally centered". A label that looks merely misaligned is
 * actually being laid out on the wrong axis, and the fix has to out-specify the
 * layer rather than relax it — every single-line label in every other section
 * depends on that rule being what it is.
 *
 * @param detail The second line. Omitted entirely when absent, so a row with no
 *               unit sits vertically centered rather than hanging above a gap.
 */
export function TimelineChartRowLabel({ children, detail, title, className, ...rest }: {
    children: React.ReactNode,
    detail?: React.ReactNode,

    /** Native tooltip, for a name the column is too narrow to show in full. */
    title?: string,

    /** Extra classes on the cell — a section's own row separators, typically. */
    className?: string
    // Everything else lands on the cell. This is what carries the layer's row
    // hover handlers: the label is a grid item, so the layer clones mouse
    // handlers onto it, and a component that swallowed them would mark its row
    // only from the content side.
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className" | "title">) {
    return (
        <div
            className={["cp-timeline-chart-row-label", className].filter(Boolean).join(" ")}
            title={title}
            {...rest}
        >
            <span className="cp-timeline-chart-row-label-name">{children}</span>
            { detail !== undefined && detail !== null && detail !== "" &&
                <span className="cp-timeline-chart-row-label-detail">{detail}</span> }
        </div>
    );
}

/**
 * The metadata panel: one collapsible entry per section, each holding whatever
 * that section chose to say about itself — a narrative, what the current
 * selection means to it, and its settings.
 *
 * The sidebar renders only the frame. Every panel's content is portalled in by
 * the section that owns it, so the sidebar never needs to know what a section
 * contains.
 */
function TimelineChartSidebar({ handleProps }: { handleProps: React.HTMLAttributes<HTMLDivElement> })
{
    const { sidebarPanel, sidebarOpen, sections } = useTimelineChartContext();

    // Which entries are expanded. Kept here rather than inside each Collapse so
    // that a section's gear can open its entry from across the chart.
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // A gear click names a section; expand it and leave everything else as it is.
    useEffect(() => {
        if (sidebarPanel && sidebarPanel !== "overview") {
            setExpanded(prev => prev[sidebarPanel] ? prev : { ...prev, [sidebarPanel]: true });
        }
    }, [sidebarPanel]);

    return (
        // Hidden from assistive tech and from tabbing while collapsed — it is
        // still in the DOM, just animated down to nothing.
        <aside className="cp-timeline-chart-sidebar" aria-hidden={!sidebarOpen}>
            {/* Sits on the sidebar's own left border. Inside the aside rather
                than beside it so the collapsed state takes it out of reach and
                out of the tab order along with everything else in here. */}
            <div {...handleProps} />
            {/* The scroller is taken out of flow so its content cannot size the
                grid row. Without that, expanding a resource tree grows the row
                and the chart with it, and `overflow` never engages. */}
            <div className="cp-timeline-chart-sidebar-scroll">
                { sections.map(section => (
                    <Collapse
                        key={section.id}
                        label={<><b>{section.title || "Untitled section"}</b></>}
                        open={!!expanded[section.id]}
                        onToggle={open => setExpanded(prev => ({ ...prev, [section.id]: open }))}
                    >
                        {/* The section's own panel lands here. Collapse only
                            renders its children while open, so a collapsed
                            entry costs nothing. */}
                        <div style={{ padding: '0.5rem 0.75rem' }}>
                            <TimelineChartSidebarSlot sectionId={section.id} />
                        </div>
                    </Collapse>
                )) }
            </div>
        </aside>
    );
}

/**
 * The element a section portals its sidebar panel into.
 *
 * A component rather than an inline callback ref: an inline one is a new
 * function every render, which React detaches and re-attaches each time — and
 * since attaching writes to context, that is an endless render loop. Registering
 * from an effect runs once per mount instead.
 */
function TimelineChartSidebarSlot({ sectionId }: { sectionId: string })
{
    const { setSidebarElement } = useTimelineChartContext();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSidebarElement(sectionId, ref.current);
        return () => setSidebarElement(sectionId, null);
    }, [sectionId, setSidebarElement]);

    return <div ref={ref} />;
}

/**
 * One layer's slice of the chart-wide pointer ruler.
 *
 * Rendered by every layer rather than once over the whole grid, so the rule is
 * a series of segments confined to the plotting areas — it stops at each
 * section's edges instead of striking through headers, legends and the gaps
 * between them.
 */
export function TimelineChartRuler()
{
    const { rulerPercent } = useTimelineChartContext();

    if (rulerPercent === undefined) {
        return null;
    }

    return <div className="cp-timeline-chart-ruler" style={{ left: `${rulerPercent}%` }} />;
}

export function TimelineChartHighlight()
{
    const {
        highlightRangeStart,
        highlightRangeEnd,
        visibleRangeStart,
        visibleRangeEnd,
        toPercent
    } = useTimelineChartContext();

    // No selection to render
    if (highlightRangeStart === undefined || highlightRangeEnd === undefined) {
        return null;
    }

    // No visible range to render
    if (visibleRangeEnd - visibleRangeStart <= 0) {
        return null;
    }

    const start = Math.min(highlightRangeStart, highlightRangeEnd);
    const end   = Math.max(highlightRangeStart, highlightRangeEnd);

    const clampedStart = Math.max(start, visibleRangeStart);
    const clampedEnd   = Math.min(end,   visibleRangeEnd);

    // Entirely outside the visible range. Note that this is `>` rather than
    // `>=`, so a selection whose start and end are the same instant survives
    // and renders as a line.
    if (clampedStart > clampedEnd) {
        return null;
    }

    const intersectionStart = toPercent(clampedStart);
    const intersectionEnd   = toPercent(clampedEnd);

    return (
        <div
            className={`cp-timeline-chart-highlight${start === end ? " cp-timeline-chart-highlight-instant" : ""}`}
            style={{
                left : `${intersectionStart}%`,
                width: `${intersectionEnd - intersectionStart}%`
            }}
        />
    );
}


// TimelineChartLayer ----------------------------------------------------------

export interface TimelineChartLayerProps {
    label: React.ReactNode;

    /**
     * A key to what the section's marks mean — which color is which medication
     * class, say. Rendered on its own row beneath the section header, spanning
     * the content column.
     *
     * This is for explaining the data, not for controls. Buttons and counts
     * belong in the header, where each section renders its own.
     */
    legend?: React.ReactNode;

    /**
     * How many rows of the parent grid this layer occupies. Both the label and
     * the content column span the same rows, so the two stay aligned no matter
     * how tall any individual row turns out to be.
     */
    rows?: number;

    /** Left column content — one element per row. */
    labels?: React.ReactNode;

    /** Minimum height of a single row. */
    rowHeight?: number | string;

    /**
     * Name this section is known by in the sidebar. Falls back to `label` when
     * that is a plain string.
     */
    title?: string;

    /** Extent of this section's data, if it has any to declare. */
    dataRangeStart?: number;
    dataRangeEnd?: number;

    /**
     * Section-specific settings. When provided, a gear appears in the header
     * that opens this content in the sidebar.
     */
    settings?: React.ReactNode;

    /** Prose explaining what this section is showing. Sidebar only. */
    narrative?: React.ReactNode;

    /**
     * What the current selection means to this section. Sidebar only.
     *
     * Sections derive this from the chart's selection rather than being told
     * when a mark is clicked, so the panel stays correct however the selection
     * was made — including by another section.
     */
    selection?: React.ReactNode;

    /** Right column content — one element per row, plus any absolutely positioned overlays. */
    children?: React.ReactNode;
}

/**
 * Whether a child is one of the layer's overlays rather than a row.
 *
 * The highlight and the ruler are siblings of the rows but are absolutely
 * positioned boxes spanning the whole layer. They must not be counted when
 * pairing a label with its content — a section that renders its highlight
 * first would otherwise shift every row's index by one against the opposite
 * column — nor take a hover mark of their own.
 */
function isOverlay(node: ReactNode): boolean {
    return isValidElement(node)
        && (node.type === TimelineChartHighlight || node.type === TimelineChartRuler);
}

export function TimelineChartLayer({
    label,
    legend = null,
    rows = 1,
    labels = null,
    rowHeight = "1.6em",
    title,
    dataRangeStart,
    dataRangeEnd,
    settings = null,
    narrative = null,
    selection = null,
    children = null
}: TimelineChartLayerProps)
{
    const { panning, panProps } = usePan();
    const { sidebarElements, setSidebarPanel, clearHighlight } = useTimelineChartContext();

    // Sections open expanded: a chart that hid its own contents until asked
    // would not read as a chart. The section stays registered while collapsed,
    // so it keeps its sidebar entry, its settings and its contribution to the
    // chart's overall extent.
    const [collapsed, setCollapsed] = useState(false);

    const id = useSection({
        title: title ?? (typeof label === "string" ? label : ""),
        dataRangeStart,
        dataRangeEnd,
        hasSettings: !!settings,
        // Reported outward only because the chart's axis depends on it: with
        // every section folded up there is no plot for a date to line up
        // against. Nothing else outside this layer reads it.
        collapsed
    });

    // A row's label and its content are in two different subgrid containers,
    // with no shared element and no way for CSS to correlate them by position.
    // So the hovered row is tracked here — the one component that renders both
    // columns — and marked on each side from the same index.
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);

    // Settles the hover once a drag ends: the marked row keeps its highlight if
    // the pointer came to rest on it, and loses it otherwise. Hit tested rather
    // than read off the event target, which pointer capture would have
    // rewritten to the panning element.
    useEffect(() => {
        if (hoveredRow === null) {
            return;
        }

        function onPointerUp(event: PointerEvent) {
            const under = document.elementFromPoint(event.clientX, event.clientY);

            if (!under?.closest(".cp-timeline-row-hover")) {
                setHoveredRow(null);
            }
        }

        window.addEventListener("pointerup", onPointerUp);

        return () => window.removeEventListener("pointerup", onPointerUp);
    }, [hoveredRow]);

    /**
     * Marks each row with its index so the opposite column can be marked with
     * it, without either side having to know the other exists.
     *
     * Done by cloning rather than by wrapping: these children are the layer's
     * grid items, and a wrapper would insert a box between them and the subgrid
     * — taking the row sizing with it. Sections that already set a `className`
     * or their own mouse handlers keep both; the row mark is added to the one
     * and runs before the other.
     */
    function withRowHover(nodes: ReactNode): ReactNode {
        let row = -1;

        return Children.map(nodes, node => {
            if (!isValidElement(node) || isOverlay(node)) {
                return node;
            }

            const index = ++row;
            const props = node.props as {
                className?: string,
                onMouseEnter?: (event: React.MouseEvent) => void,
                onMouseLeave?: (event: React.MouseEvent) => void
            };

            return cloneElement(node as ReactElement<Record<string, unknown>>, {
                className: [props.className, hoveredRow === index ? "cp-timeline-row-hover" : null]
                    .filter(Boolean).join(" ") || undefined,

                onMouseEnter: (event: React.MouseEvent) => {
                    props.onMouseEnter?.(event);
                    setHoveredRow(index);
                },

                onMouseLeave: (event: React.MouseEvent) => {
                    props.onMouseLeave?.(event);

                    // A pan captures the pointer, which re-targets mouse events
                    // and makes the row report a leave the instant the drag
                    // starts — even though the pointer is still on it. So a
                    // leave with a button held is ignored, and the release
                    // above decides what really happened.
                    if (event.buttons !== 0) {
                        return;
                    }

                    setHoveredRow(current => current === index ? null : current);
                }
            });
        });
    }

    // Both columns span the same parent rows and adopt them via subgrid, so
    // row N of the labels always lines up with row N of the content.
    const span = {
        gridRow: `span ${rows}`,
        "--cp-timeline-chart-row-height": typeof rowHeight === "number" ? `${rowHeight}px` : rowHeight
    } as React.CSSProperties;

    return [
        <div className="cp-timeline-chart-layer-header" key="header">
            <button
                className="cp-timeline-chart-layer-toggle"
                onClick={() => setCollapsed(value => !value)}
                aria-expanded={!collapsed}
                title={collapsed ? "Expand section" : "Collapse section"}
            >
                <ChevronDown size={14} style={{ display: "block" }} />
            </button>
            {typeof label === "string" ? <div className="cp-timeline-chart-layer-header-label">{label}</div> : label}
            <div style={{ flex: 1 }}>
                <div style={{ borderTop: "2px solid var(--cp-color-win-2)", borderBottom: "2px solid var(--cp-color-win-2)", height: 5 }}></div>
            </div>
            { settings && (
                <button
                    // Opens the sidebar and expands this section's entry in it.
                    onClick={() => setSidebarPanel(id)}
                    title="Section settings"
                    className="cp-p-1 cp-px-1"
                >
                    <Cog size={14} style={{ display: "block" }} />
                </button>
            )}
        </div>,

        // Its own row under the header rather than an item inside it, so a legend
        // with many entries wraps across the content width instead of squeezing
        // the header rule. Goes with the rows it explains: a key to marks that
        // are not on screen is just clutter.
        legend && !collapsed
            ? <div className="cp-timeline-chart-layer-legend" key="legend">{legend}</div>
            : null,

        // Unmounted rather than hidden. These two are grid items adopting the
        // parent's row tracks through subgrid, so there is no box to animate
        // and nothing that could stay in the layout at zero height without
        // still claiming its rows.
        collapsed ? null :
        <div className="cp-timeline-chart-layer-y-axis" key="labels" style={span}>{withRowHover(labels)}</div>,

        collapsed ? null :
        <div
            className={`cp-timeline-chart-layer-y-content${panning ? " cp-timeline-chart-panning" : ""}`}
            key="content"
            style={span}
            {...panProps}

            // Clicking empty timeline drops the selection. Marks stop the event
            // before it gets here, and `usePan` swallows the click that ends a
            // drag, so this only fires for a genuine click on nothing.
            onClick={clearHighlight}
        >
            {withRowHover(children)}
            <TimelineChartRuler />
        </div>,

        // The sidebar panel lives in the sidebar but is owned by the section, so
        // it is portalled rather than handed to the registry — that keeps it
        // re-rendering normally instead of forcing a re-registration whenever
        // its content changes. The slot only exists while the section's sidebar
        // entry is expanded, so a collapsed panel renders nothing.
        sidebarElements[id] ?
            createPortal(
                <div className="cp-timeline-chart-sidebar-panel">
                    { narrative && (
                        <section className="cp-text-txt-6 cp-pb-3">
                            {narrative}
                        </section>
                    )}
                    { selection && (
                        <section>
                            <h5 className="cp-text-teal cp-pb-3" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <SquareDashedMousePointer size={15} style={{ display: "block" }} className="cp-text-teal" />
                                Selection
                            </h5>
                            {selection}
                        </section>
                    )}
                    { settings && (
                        <section>
                            <h5 className="cp-text-teal cp-pb-3" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <Cog size={15} style={{ display: "block" }} className="cp-text-teal" />
                                Settings
                            </h5>
                            {settings}
                        </section>
                    )}
                </div>,
                sidebarElements[id]!,
                `panel-${id}`
            ) :
            null
    ]
}

const MINUTE = 1000 * 60;
const HOUR   = MINUTE * 60;
const DAY    = HOUR * 24;

// Averages, not calendar arithmetic — these only pick a format, so being a few
// hours out either side of a boundary changes nothing anyone can see.
const MONTH  = DAY * 30.44;
const YEAR   = DAY * 365.25;

type AxisScale = "year" | "date" | "day" | "time";

/**
 * How precise the axis labels need to be for a given span. Showing a full date
 * across a decade is noise, and showing only a year across a week says nothing.
 */
function axisScale(range: number): AxisScale {
    if (range > YEAR * 3) return "year";
    if (range > MONTH)    return "date";
    if (range > DAY)      return "day";
    return "time";
}

/**
 * Field selections rather than literal patterns, so each renders in the reader's
 * locale — "12/05/2002" in the US, "05/12/2002" in the UK.
 */
const AXIS_FORMATS: Record<AxisScale, Intl.DateTimeFormatOptions> = {
    year: { year: "numeric" },
    date: { year: "numeric", month: "2-digit", day: "2-digit" },

    // The year is dropped here: across days it is the same on every label, and
    // repeating it three times crowds them out.
    day : { month: "short", day: "numeric" },
    time: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
};

/**
 * Most dates the axis will name. Past this they stop being landmarks and start
 * being a ruler nobody reads.
 *
 * There is no floor any more. Labels sit on calendar boundaries, so how many
 * there are is decided by which division the window is wide enough for — and a
 * window can honestly contain only one round date, or none it has room to
 * print. Forcing a second would mean inventing a date that is not a boundary,
 * which is exactly what the ticks were changed to stop doing.
 */
export const AXIS_LABEL_COUNT = { max: 5 };

/**
 * Whitespace each label needs beside it, as a fraction of its own width. Tuned
 * so labels are separated by roughly half a label — close enough to read as a
 * series, far enough apart not to run together at the widest format.
 */
const AXIS_LABEL_GAP = 0.6;

/** A calendar interval the axis can divide by. */
type TickStep = {
    unit  : "minute" | "hour" | "day" | "month" | "year",
    amount: number,

    /** Roughly how long one step lasts, for choosing between them. */
    approx: number
};

/**
 * Divisions the axis will consider, finest first.
 *
 * Every one is a calendar interval rather than a fraction of the visible range,
 * which is the whole point: a tick marks the start of a year, a month, a day —
 * something a reader can name. Ticks placed by dividing the window instead land
 * on arbitrary instants, and beside labels that are years apart they suggest
 * boundaries that do not exist.
 *
 * The multiples are the ones people count in. Nothing offers 7 hours or 4
 * months, because a reader seeing four ticks between two years expects quarters.
 */
const TICK_STEPS: TickStep[] = [
    { unit: "minute", amount: 1,   approx: MINUTE },
    { unit: "minute", amount: 5,   approx: MINUTE * 5 },
    { unit: "minute", amount: 15,  approx: MINUTE * 15 },
    { unit: "minute", amount: 30,  approx: MINUTE * 30 },
    { unit: "hour",   amount: 1,   approx: HOUR },
    { unit: "hour",   amount: 3,   approx: HOUR * 3 },
    { unit: "hour",   amount: 6,   approx: HOUR * 6 },
    { unit: "hour",   amount: 12,  approx: HOUR * 12 },
    { unit: "day",    amount: 1,   approx: DAY },
    { unit: "day",    amount: 2,   approx: DAY * 2 },
    { unit: "day",    amount: 7,   approx: DAY * 7 },
    { unit: "day",    amount: 14,  approx: DAY * 14 },
    { unit: "month",  amount: 1,   approx: MONTH },
    { unit: "month",  amount: 3,   approx: MONTH * 3 },
    { unit: "month",  amount: 6,   approx: MONTH * 6 },
    { unit: "year",   amount: 1,   approx: YEAR },
    { unit: "year",   amount: 2,   approx: YEAR * 2 },
    { unit: "year",   amount: 5,   approx: YEAR * 5 },
    { unit: "year",   amount: 10,  approx: YEAR * 10 },
    { unit: "year",   amount: 25,  approx: YEAR * 25 },
    { unit: "year",   amount: 50,  approx: YEAR * 50 },
    { unit: "year",   amount: 100, approx: YEAR * 100 }
];

/** Narrowest a tick spacing may get before the next coarser step is used. */
const MIN_TICK_SPACING = 55;

/**
 * Local midnight of a known Sunday: the origin every day-based grid counts from.
 *
 * Day steps cannot align to their month the way quarters align to their year.
 * Months are 28 to 31 days, so a grid restarted at each 1st leaves a stub of
 * two or three days at every month end — which showed up as ticks in uneven
 * clusters, and as labels two days apart colliding while their neighbors sat a
 * fortnight away. Counting from one fixed day instead makes every interval
 * exactly `amount` days, everywhere, at the cost of the grid not lining up with
 * the 1st of the month. A Sunday is the origin so that the 7- and 14-day steps
 * land on week boundaries.
 */
const DAY_GRID_ORIGIN = new Date(1970, 0, 4);

/**
 * The last boundary of this step at or before `time`.
 *
 * Multi-unit steps align to the containing unit rather than to the epoch, so
 * quarters start in January and not in whatever month the data happens to
 * begin. Hours and minutes divide their unit evenly — 24 and 60 are divisible
 * by every amount offered — so those grids are regular for free. Days are the
 * exception, and count from {@link DAY_GRID_ORIGIN} instead.
 */
function floorToStep(time: number, step: TickStep): Date {
    const date = new Date(time);

    switch (step.unit) {
        case "year":
            return new Date(Math.floor(date.getFullYear() / step.amount) * step.amount, 0, 1);

        case "month":
            return new Date(
                date.getFullYear(),
                Math.floor(date.getMonth() / step.amount) * step.amount,
                1
            );

        case "day": {
            const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            // Rounded, not truncated: the two midnights are a whole number of
            // days apart only in principle, since a clock change puts 23 or 25
            // hours between them and would otherwise floor to the day before.
            const days = Math.round((midnight.getTime() - DAY_GRID_ORIGIN.getTime()) / DAY);

            return new Date(
                DAY_GRID_ORIGIN.getFullYear(),
                DAY_GRID_ORIGIN.getMonth(),
                DAY_GRID_ORIGIN.getDate() + Math.floor(days / step.amount) * step.amount
            );
        }

        case "hour":
            return new Date(
                date.getFullYear(), date.getMonth(), date.getDate(),
                Math.floor(date.getHours() / step.amount) * step.amount
            );

        default:
            return new Date(
                date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(),
                Math.floor(date.getMinutes() / step.amount) * step.amount
            );
    }
}

/** The next boundary after `date`. */
function advanceStep(date: Date, step: TickStep): Date {
    const next = new Date(date);

    switch (step.unit) {
        case "year":
            next.setFullYear(next.getFullYear() + step.amount);
            break;

        case "month":
            next.setMonth(next.getMonth() + step.amount);
            break;

        case "day":
            // Straight through month ends. `setDate` normalizes past the last
            // day of the month, and keeps the result at local midnight across a
            // clock change rather than drifting an hour either way.
            next.setDate(next.getDate() + step.amount);
            break;

        case "hour":
            next.setHours(next.getHours() + step.amount);
            break;

        default:
            next.setMinutes(next.getMinutes() + step.amount);
    }

    return next;
}

/** The coarsest division that still fits `maxCount` of them across the range. */
function pickStep(range: number, maxCount: number): TickStep {
    return TICK_STEPS.find(candidate => range / candidate.approx <= maxCount)
        ?? TICK_STEPS[TICK_STEPS.length - 1];
}

/**
 * Every boundary of `step` strictly inside the range.
 *
 * Both ends are excluded on purpose: a mark exactly on the edge of the window
 * is indistinguishable from the plot's own border, and a label there would hang
 * half of itself outside the chart.
 */
function stepTimes(start: number, end: number, step: TickStep): number[] {
    const times: number[] = [];

    // Bounded so a step that somehow fails to advance — a DST fold at an hour
    // boundary, say — cannot spin here forever.
    let cursor = floorToStep(start, step);
    let guard  = 0;

    while (cursor.getTime() < end && guard++ < 400) {
        const time = cursor.getTime();
        const next = advanceStep(cursor, step);

        if (next.getTime() <= time) {
            break;
        }

        if (time > start) {
            times.push(time);
        }

        cursor = next;
    }

    return times;
}

/**
 * Boundaries of the coarsest division that still yields something, stepping
 * finer until the range contains at least one.
 *
 * A window narrower than its own division holds no boundary at all — half a
 * month at a monthly step, say — which would leave the axis blank. Stepping
 * down finds the division that actually has something to say about a window
 * that size.
 */
function boundariesWithin(start: number, end: number, maxCount: number): number[] {
    const range = end - start;

    if (!(range > 0)) {
        return [];
    }

    let index = TICK_STEPS.indexOf(pickStep(range, maxCount));
    let times = stepTimes(start, end, TICK_STEPS[index]);

    while (times.length === 0 && index > 0) {
        times = stepTimes(start, end, TICK_STEPS[--index]);
    }

    return times;
}

/**
 * A canvas kept for measuring text, created once.
 *
 * `undefined` means not yet attempted, `null` means the environment has no 2D
 * context to give — which is the case under jsdom, and the reason every caller
 * has to cope with getting no measurement back.
 */
let measureContext: CanvasRenderingContext2D | null | undefined;

/**
 * Width of a string as the axis would actually draw it.
 *
 * Measured rather than estimated because the answer decides how many labels fit,
 * and the formats differ enormously between scales — "2024" against
 * "Mar 12, 3:45 PM" is a factor of four. Falls back to a character-count
 * estimate where no canvas is available; the estimate is coarse, but it only
 * ever shifts the count by one at a boundary.
 */
function labelWidth(sample: string, element: HTMLElement): number {
    const style = getComputedStyle(element);
    const size  = parseFloat(style.fontSize) || 12;

    if (measureContext === undefined) {
        measureContext = document.createElement("canvas").getContext("2d");
    }

    if (measureContext) {
        measureContext.font = style.font || `${style.fontSize} ${style.fontFamily}`;
        const measured = measureContext.measureText(sample).width;
        if (measured > 0) return measured;
    }

    // Roughly the average advance of a proportional face at this size.
    return sample.length * size * 0.6;
}

export function TimelineChartAxis() {
    const { visibleRangeStart, visibleRangeEnd, setPlotElement } = useTimelineChartContext();

    const scale = axisScale(visibleRangeEnd - visibleRangeStart);

    // Keyed on the scale rather than the range, so a drag or a zoom only rebuilds
    // the formatter when the format itself changes, not on every frame.
    const format = useMemo(() => new Intl.DateTimeFormat(undefined, AXIS_FORMATS[scale]), [scale]);

    const element = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);

    // One node, two jobs: the context needs it as the plot reference, and the
    // label count needs its width.
    //
    // Stable by way of `useCallback`, and that matters more than it looks: React
    // re-runs a ref callback whose identity changed, detaching with null before
    // reattaching. A fresh function each render would therefore push null into
    // `plotElement` on every render — leaving the pointer-to-time conversion
    // without a reference for that beat, and setting state during a commit that
    // then schedules another.
    const attach = useCallback((node: HTMLDivElement | null) => {
        element.current = node;
        setPlotElement(node);
    }, [setPlotElement]);

    useEffect(() => {
        const node = element.current;
        if (!node) return;

        setWidth(node.getBoundingClientRect().width);

        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    /**
     * The dates the axis names, on calendar boundaries like the ticks.
     *
     * Spread evenly across the range instead, a label sat at whatever instant
     * its share of the window happened to fall on — so "2018" marked a day in
     * the middle of 2018, and the ticks that now mark real year boundaries
     * would disagree with it. Both come off the same grid, so a label always
     * names the boundary it sits on.
     *
     * How many appear is still governed by how wide they measure: the step is
     * the coarsest division that leaves room for the text plus its gap. What
     * changed is that thinning now jumps a whole division — years to five
     * years, months to quarters — rather than dropping to an arbitrary count,
     * so the dates stay round at every density.
     */
    const labels = useMemo(() => {
        const node  = element.current;
        const range = visibleRangeEnd - visibleRangeStart;

        // Nothing can be placed before the column has been measured. The
        // observer above sets a width immediately after mount, and this runs
        // again with it.
        if (!node || width <= 0 || !(range > 0)) {
            return [];
        }

        // Measured against the wider of the two ends. Labels in one scale are
        // near enough the same width that either would do, but the longer one
        // is the safe side to be wrong on.
        const sample = [visibleRangeStart, visibleRangeEnd]
            .map(time => format.format(time))
            .reduce((a, b) => a.length >= b.length ? a : b);

        const each = labelWidth(sample, node) * (1 + AXIS_LABEL_GAP);

        const maxCount = Math.min(AXIS_LABEL_COUNT.max, Math.max(1, Math.floor(width / each)));

        return boundariesWithin(visibleRangeStart, visibleRangeEnd, maxCount)
            .map(time => {
                const text     = format.format(time);
                const fraction = (time - visibleRangeStart) / range;

                // Measured per label rather than taken from the sample: this
                // decides whether a label is dropped, and being wrong by a few
                // pixels either drops one that would have fitted or keeps one
                // that spills.
                const half   = labelWidth(text, node) / 2;
                const center = fraction * width;

                return { time, text, fraction, half, center };
            })
            // A label centred on its own date is the point of the exercise, so
            // one whose date sits too near an edge has nowhere to go: shifting
            // it inward would make it name a boundary it is no longer over, and
            // leaving it puts half the text outside the plot. Dropping it is
            // the only option that keeps the rest honest — the boundary itself
            // still has its tick.
            .filter(({ center, half }) => center - half >= 0 && center + half <= width);
    }, [width, visibleRangeStart, visibleRangeEnd, format]);

    /**
     * Where the ticks go: on calendar boundaries, independently of the labels.
     *
     * They used to be midpoints between neighbouring labels, which put them at
     * whatever instant fell halfway — and since the labels were themselves
     * evenly spaced samples of the visible range rather than round dates, that
     * instant was arbitrary. With labels reading 2016, 2018, 2020 the tick
     * between two of them was not the year boundary it looked like.
     *
     * Finer than the labels, and chosen by its own spacing: the labels have to
     * fit their text, a tick only has to be distinguishable from the next one.
     */
    const ticks = useMemo(() => {
        const range = visibleRangeEnd - visibleRangeStart;

        if (!(range > 0)) {
            return [];
        }

        return boundariesWithin(
            visibleRangeStart,
            visibleRangeEnd,
            Math.max(1, Math.floor(width / MIN_TICK_SPACING))
        ).map(time => (time - visibleRangeStart) / range);
    }, [visibleRangeStart, visibleRangeEnd, width]);

    // The axis spans exactly the plot column, so it doubles as the reference for
    // turning pointer positions into times.
    return (
        <div className="cp-timeline-chart-x-axis" ref={attach}>
            { ticks.map(fraction => (
                <div
                    key={`tick-${fraction}`}
                    className="cp-timeline-chart-x-axis-tick"
                    style={{ left: `${fraction * 100}%` }}
                />
            ))}
            { labels.map(({ time, text, fraction }) => (
                <div
                    // Keyed on the date rather than the position, so panning
                    // moves each label rather than recycling it into a
                    // different one.
                    key={time}
                    style={{
                        left: `${fraction * 100}%`,
                        // Every label is centred on the boundary it names —
                        // no exceptions for the ends any more. They used to be
                        // flush-aligned because they sat exactly on the edges
                        // of the window; a label now only appears where it has
                        // room to be centred, so anything still on screen fits
                        // as drawn.
                        transform: "translateX(-50%)"
                    }}
                >
                    {text}
                </div>
            )) }
        </div>
    )
}

