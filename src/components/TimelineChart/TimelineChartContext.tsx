import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";

/**
 * What one section tells the chart about itself.
 *
 * Every field is a primitive on purpose. Sections re-register whenever any of
 * these change, so anything with an unstable identity — a ReactNode, an array,
 * a callback — would re-register on every render. Section *content* for the
 * sidebar is portalled in by the section itself rather than stored here.
 */
export type TimelineChartSection = {
    id: string,
    title: string,

    /** Extent of this section's data, if it has any to declare. */
    dataRangeStart?: number,
    dataRangeEnd?: number,

    /** Whether this section offers a settings panel, and so shows a gear in its header. */
    hasSettings: boolean,

    /**
     * Whether the section is folded up to its header.
     *
     * Reported outward, unlike the rest of a layer's own view state, because the
     * chart cannot draw its axis without it: with every section collapsed there
     * is no plot left for a date to line up against.
     */
    collapsed?: boolean
};

/** Which sidebar panel is showing. `null` means the sidebar is collapsed. */
export type TimelineChartSidebarPanel = "overview" | (string & {}) | null;

export type TimelineChartContextValue = {
    /**
     * Where the pointer ruler sits, as a percentage of the plotting width, or
     * undefined while the pointer is away from the plot.
     *
     * Held here rather than drawn once over the whole chart so each layer can
     * render its own segment — the rule then breaks across headers, legends and
     * the gaps between sections instead of running through them, the same way
     * the selection highlight does.
     */
    rulerPercent?: number,

    /** Set by the chart's own pointer tracking; sections only read it. */
    setRulerPercent: (percent: number | undefined) => void,

    highlightRangeStart?: number,
    highlightRangeEnd  ?: number,

    /**
     * Which mark the selection came from, when it came from one.
     *
     * The selected range alone cannot identify a mark: two medications may cover
     * exactly the same dates, and comparing intervals would light up both. Marks
     * pass an id when they select themselves, and only that id is selected.
     * Undefined for a selection made some other way — a date picker, say — which
     * correctly leaves every mark unselected.
     */
    selectedId?: string,

    /**
     * Which point mark is selected — a mark standing at an instant rather than
     * over a span, such as a single lab reading.
     *
     * Held apart from {@link selectedId} rather than sharing it, because the two
     * are not competing for the same slot. A bar's selection *is* the highlighted
     * range; a reading's is a resource picked out of a series, and it leaves the
     * range alone. One of each can be selected at a time, and selecting one does
     * not deselect the other — a reader lining a lab spike up against the drug
     * that preceded it needs both panels open at once, which is the point of
     * stacking the sections in one chart.
     *
     * Both are dropped together by {@link clearHighlight}, since a click on empty
     * chart means "nothing is selected" rather than "nothing of one kind is".
     */
    selectedPointId?: string,

    /**
     * The union of every extent registered by a section — that is, the full
     * span of data the chart actually contains, regardless of what is currently
     * visible. Undefined while no section has registered an extent.
     */
    dataRangeStart     ?: number,
    dataRangeEnd       ?: number,

    visibleRangeStart   : number,
    visibleRangeEnd     : number,

    /**
     * Converts a timestamp to its horizontal position, as a percentage of the
     * visible range. This is the one place the X scale is defined — every
     * section must position itself through it so they all stay in sync.
     *
     * The result is deliberately not clamped: timestamps outside the visible
     * range map to negative or >100 values, which lets sections clip their own
     * marks (and show that a mark continues off-screen) however they like.
     */
    toPercent: (time: number) => number,

    /** Inverse of {@link toPercent} — turns a horizontal position back into a timestamp. */
    fromPercent: (percent: number) => number,

    /** Registered sections, in the order they appear in the chart. */
    sections: TimelineChartSection[],

    /** Which sidebar panel is open, if any. Collapsed by default. */
    sidebarPanel: TimelineChartSidebarPanel,

    /** Convenience for `sidebarPanel !== null`. */
    sidebarOpen: boolean,

    /**
     * The sidebar's slot for each section, keyed by section id, so a section can
     * portal its own panel into its own place in the sidebar.
     *
     * A slot exists only while that section's sidebar entry is expanded, which
     * is what keeps a collapsed panel from rendering anything at all.
     */
    sidebarElements: Record<string, HTMLElement | null>,

    /**
     * An element spanning exactly the plot column, for turning pointer positions
     * into times. Every section's content column shares this geometry, so one
     * element is enough — the axis supplies it, being the one element the chart
     * always renders exactly once across the full plot width.
     */
    plotElement: HTMLElement | null,

    setHighlightRangeStart: (value: number) => void,
    setHighlightRangeEnd  : (value: number) => void,
    setVisibleRangeStart  : (value: number) => void,
    setVisibleRangeEnd    : (value: number) => void,
    setVisibleRange       : (start: number, end: number) => void,
    /**
     * Selects a range. Pass `id` when the selection comes from a specific mark,
     * so that mark — and only that mark — renders as selected.
     */
    setHighlightRange     : (start: number, end: number, id?: string) => void,

    /**
     * Selects a point mark — see {@link selectedPointId}.
     *
     * Deliberately not routed through {@link setHighlightRange}: that would
     * collapse whatever range was highlighted into a zero-width one at the
     * reading's date, throwing away a selection the click never asked to change.
     * A mark with an extent of its own should still use `setHighlightRange`, so
     * the highlight goes on showing what is selected.
     */
    setSelectedPointId    : (id?: string) => void,

    /** Drops the selection entirely, returning the chart to its unselected state. */
    clearHighlight        : () => void,
    setSidebarPanel       : (panel: TimelineChartSidebarPanel) => void,
    setSidebarElement     : (sectionId: string, element: HTMLElement | null) => void,
    setPlotElement        : (element: HTMLElement | null) => void,

    /**
     * Announces a section to the chart. Sections call this through
     * {@link useSection} rather than directly.
     */
    registerSection  : (section: TimelineChartSection) => void,
    unregisterSection: (id: string) => void,
};

export const TimelineChartContext = createContext<TimelineChartContextValue>({} as TimelineChartContextValue);

/** How far back and forward a chart can be taken when the caller does not say. */
const DEFAULT_LIMIT_HISTORY_YEARS = 100;
const DEFAULT_LIMIT_FUTURE_YEARS  = 10;

/**
 * Confine a range to the chart's limits, keeping its width wherever possible.
 *
 * Width first, position second: a pan that runs into a limit should stop there
 * with the same span still on screen, not squash against the edge. Only a range
 * wider than the limits allow loses width, and then it becomes exactly the
 * limits.
 */
function clampVisibleRange(
    start: number,
    end: number,
    limitStart: number,
    limitEnd: number
): [number, number] {
    const span  = end - start;
    const limit = limitEnd - limitStart;

    // A degenerate or inverted range has no width to preserve; leave it to the
    // caller rather than inventing one.
    if (!(span > 0) || !(limit > 0)) {
        return [start, end];
    }

    if (span >= limit)    return [limitStart, limitEnd];
    if (start < limitStart) return [limitStart, limitStart + span];
    if (end   > limitEnd)   return [limitEnd - span, limitEnd];

    return [start, end];
}

export function TimelineContextProvider({ children, limitStart, limitEnd }: {
    children: React.ReactNode,

    /**
     * The furthest the chart can be panned or zoomed, as timestamps. Passed
     * down from {@link TimelineChart}'s props of the same name.
     */
    limitStart?: number,
    limitEnd?: number
}) {

    // How much history the chart opens on when the caller does not say. Recent
    // enough that a current problem is legible, long enough to show whether it
    // is new. Override per chart with `minX`/`maxX`.
    //
    // Calendar arithmetic rather than a fixed day count: subtracting 730 days
    // drifts by a day for every leap year in the span, so the window would not
    // land on the same date it started from.
    const today = new Date();
    const now = today.getTime();
    const defaultRangeStart = new Date(today).setFullYear(today.getFullYear() - 2);

    // Nothing is selected until the user selects something.
    const [rulerPercent       , setRulerPercent       ] = useState<number|undefined>(undefined);
    const [highlightRangeStart, setHighlightRangeStart] = useState<number|undefined>(undefined);
    const [highlightRangeEnd  , setHighlightRangeEnd  ] = useState<number|undefined>(undefined);
    const [visibleRangeStart  , setVisibleRangeStart  ] = useState<number>(defaultRangeStart);
    const [visibleRangeEnd    , setVisibleRangeEnd    ] = useState<number>(now);
    const [sidebarPanel       , setSidebarPanel       ] = useState<TimelineChartSidebarPanel>(null);
    const [sidebarElements    , setSidebarElements    ] = useState<Record<string, HTMLElement | null>>({});

    const setSidebarElement = useCallback((sectionId: string, element: HTMLElement | null) => {
        setSidebarElements(prev => prev[sectionId] === element ? prev : { ...prev, [sectionId]: element });
    }, []);
    const [plotElement        , setPlotElement        ] = useState<HTMLElement | null>(null);
    const [selectedId         , setSelectedId         ] = useState<string|undefined>(undefined);
    const [selectedPointId    , setSelectedPointId    ] = useState<string|undefined>(undefined);

    // An array rather than a map, because the sidebar lists sections in the
    // order they appear in the chart. Effects run in tree order, so first
    // registration is document order — and a section only ever registers once,
    // however often its details change afterwards, which is what keeps that
    // order stable. See {@link useSection}.
    const [sections, setSections] = useState<TimelineChartSection[]>([]);

    const registerSection = useCallback((section: TimelineChartSection) => {
        setSections(prev => {
            const index = prev.findIndex(s => s.id === section.id);

            if (index < 0) {
                return [...prev, section];
            }

            // Re-registering an existing section updates it in place, so its
            // position in the sidebar does not jump when its data changes.
            const next = [...prev];
            next[index] = section;
            return next;
        });
    }, []);

    const unregisterSection = useCallback((id: string) => {
        setSections(prev => prev.some(s => s.id === id) ? prev.filter(s => s.id !== id) : prev);
    }, []);

    const [dataRangeStart, dataRangeEnd] = useMemo(() => {
        const starts = sections.map(s => s.dataRangeStart).filter(v => v !== undefined);
        const ends   = sections.map(s => s.dataRangeEnd  ).filter(v => v !== undefined);

        return [
            starts.length ? Math.min(...starts) : undefined,
            ends.length   ? Math.max(...ends)   : undefined
        ];
    }, [sections]);

    // Fixed at mount rather than read per render: limits that crept forward
    // with the clock would shift under a chart left open on screen.
    const mountedAt = useMemo(() => Date.now(), []);

    /**
     * How far the chart can be taken. Zoom already caps how *wide* the visible
     * range may get, but nothing capped where it could sit — so panning far
     * enough, or zooming out and back in at the edge, could leave the chart
     * showing a century nobody has any data for.
     */
    const [boundStart, boundEnd] = useMemo(() => {
        const at = new Date(mountedAt);

        const start = limitStart ?? new Date(at).setFullYear(at.getFullYear() - DEFAULT_LIMIT_HISTORY_YEARS);
        const end   = limitEnd   ?? new Date(at).setFullYear(at.getFullYear() + DEFAULT_LIMIT_FUTURE_YEARS);

        // Never fence off data the chart actually holds. A record reaching
        // further back than the default would otherwise have its oldest entries
        // put permanently out of reach — and the "all" preset, which spans
        // exactly this data, would be unable to show what it claims to. The
        // limits exist to stop aimless drift, not to hide readings.
        return [
            dataRangeStart !== undefined ? Math.min(start, dataRangeStart) : start,
            dataRangeEnd   !== undefined ? Math.max(end,   dataRangeEnd)   : end
        ];
    }, [limitStart, limitEnd, mountedAt, dataRangeStart, dataRangeEnd]);

    const clampEdge = (value: number) => Math.min(Math.max(value, boundStart), boundEnd);

    const visibleRange = visibleRangeEnd - visibleRangeStart;

    const toPercent = useCallback(
        (time: number) => visibleRange > 0 ? (time - visibleRangeStart) / visibleRange * 100 : 0,
        [visibleRangeStart, visibleRange]
    );

    const fromPercent = useCallback(
        (percent: number) => visibleRangeStart + visibleRange * percent / 100,
        [visibleRangeStart, visibleRange]
    );

    const value = {
        rulerPercent,
        setRulerPercent,
        highlightRangeStart,
        highlightRangeEnd,
        selectedId,
        selectedPointId,
        dataRangeStart,
        dataRangeEnd,
        visibleRangeStart,
        visibleRangeEnd,
        toPercent,
        fromPercent,
        sections,
        sidebarPanel,
        sidebarOpen: sidebarPanel !== null,
        sidebarElements,
        plotElement,

        setHighlightRangeStart,
        setHighlightRangeEnd,
        setSelectedPointId,

        // Both edges are clamped as well as `setVisibleRange` below, so a
        // `minX`/`maxX` outside the limits cannot seed a range that panning
        // could never have reached.
        setVisibleRangeStart: (value: number) => setVisibleRangeStart(clampEdge(value)),
        setVisibleRangeEnd  : (value: number) => setVisibleRangeEnd(clampEdge(value)),

        setSidebarPanel,
        setSidebarElement,
        setPlotElement,
        registerSection,
        unregisterSection,
        // The one place every range change passes through — dragging, zooming,
        // arrow keys and the toolbar presets all end up here — so the limits
        // are applied once rather than restated at each call site.
        setVisibleRange: (start: number, end: number) => {
            const [clampedStart, clampedEnd] = clampVisibleRange(start, end, boundStart, boundEnd);

            setVisibleRangeStart(clampedStart);
            setVisibleRangeEnd(clampedEnd);
        },
        setHighlightRange: (start: number, end: number, id?: string) => {
            setHighlightRangeStart(start);
            setHighlightRangeEnd(end);
            setSelectedId(id);
        },
        clearHighlight: () => {
            setHighlightRangeStart(undefined);
            setHighlightRangeEnd(undefined);
            setSelectedId(undefined);

            // Both kinds, so a click on empty chart is the one gesture that
            // clears everything. Without it a selected reading could only be
            // dropped by selecting a different one.
            setSelectedPointId(undefined);
        }
    };

    return (
        <TimelineChartContext.Provider value={value}>
            {children}
        </TimelineChartContext.Provider>
    );
}

/**
 * Registers the calling section with the chart and returns the id it was given.
 *
 * Identity and data extent are declared together, in one call, so they cannot
 * drift apart. Leave `dataRangeStart`/`dataRangeEnd` undefined for a section
 * with nothing to contribute — no data loaded yet, or nothing in it. Such a
 * section is left out of the chart's data range entirely rather than collapsing
 * it toward zero.
 */
export function useSection({ title, dataRangeStart, dataRangeEnd, hasSettings = false, collapsed = false }: {
    title: string,
    dataRangeStart?: number,
    dataRangeEnd?: number,
    hasSettings?: boolean,
    collapsed?: boolean
}) {
    const id = useId();
    const { registerSection, unregisterSection } = useTimelineChartContext();

    // Registration and removal are deliberately separate effects.
    //
    // Combined, the cleanup runs on every change to the details below, not only
    // on unmount — so a section that merely revised its extent was removed and
    // then re-added, landing at the end of the list. Toggling a section's own
    // setting therefore reordered the sidebar and sent it to the bottom, while
    // `registerSection`'s update-in-place branch never ran at all: by the time
    // it looked, the section it meant to update was gone.
    useEffect(() => {
        registerSection({ id, title, dataRangeStart, dataRangeEnd, hasSettings, collapsed });
    }, [id, title, dataRangeStart, dataRangeEnd, hasSettings, collapsed, registerSection]);

    // Unmount only. `id` is stable for the section's lifetime, so this cleanup
    // cannot fire for any other reason.
    useEffect(() => {
        return () => unregisterSection(id);
    }, [id, unregisterSection]);

    return id;
}

export function useTimelineChartContext() {
    const context = useContext(TimelineChartContext);
    if (!context) {
        throw new Error("useTimelineChartContext must be used within a TimelineChartProvider");
    }
    return context;
}
