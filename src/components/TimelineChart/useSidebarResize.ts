import { useCallback, useRef, useState, type RefObject } from "react";

/**
 * Narrowest the sidebar can be dragged, in px.
 *
 * The `18em` the track used to be given as its minimum, resolved at the root
 * font size. In px because the drag arithmetic is in px, and a min expressed in
 * em would need the element's computed font size read back on every frame to
 * mean anything.
 */
const MIN_WIDTH = 288;

/** Starting width, and the one a double-click on the handle returns to. */
const DEFAULT_WIDTH = 320;

/**
 * The most of the chart the sidebar may take. Past half, the thing the sidebar
 * describes is narrower than the description.
 */
const MAX_FRACTION = 0.5;

/** Keyboard step, in px. Coarse enough to be worth pressing, fine enough to aim. */
const KEY_STEP = 16;

/**
 * Applied to the chart root while a drag is in progress. The stylesheet
 * transitions `grid-template-columns` for the open/close animation, which would
 * otherwise ease toward the pointer on every frame and leave the sidebar
 * trailing the handle by the length of that transition.
 */
const RESIZING_CLASS = "cp-timeline-chart--resizing";

const WIDTH_PROPERTY = "--cp-timeline-sidebar-width";

type Drag = {
    pointerId : number,
    startX    : number,
    startWidth: number
};

/**
 * Drag-to-resize for the sidebar column.
 *
 * Returns the current width — which the chart root renders as a custom property
 * — and the props for the handle that changes it.
 *
 * The width is held in memory only. It is deliberately not persisted: doing so
 * needs a stable key, and the chart has no identity of its own to build one
 * from.
 */
export function useSidebarResize(rootRef: RefObject<HTMLElement | null>) {
    const [width, setWidth] = useState(DEFAULT_WIDTH);

    const drag = useRef<Drag | null>(null);

    // The value the drag has reached, which is not `width`: during a drag the
    // number is written straight to the DOM and only committed to state on
    // release. Routing every frame through setState would re-render the whole
    // chart — every section, every bar — to move one grid line.
    const live = useRef(width);

    const clamp = useCallback((value: number) => {
        const root = rootRef.current;
        const max  = root ? root.getBoundingClientRect().width * MAX_FRACTION : Infinity;

        // A chart narrower than twice the minimum has no room to honor both
        // bounds; the minimum is the one that keeps the sidebar usable.
        return Math.max(MIN_WIDTH, Math.min(value, Math.max(MIN_WIDTH, max)));
    }, [rootRef]);

    /** Writes a width without re-rendering. Used for every frame of a drag. */
    const paint = useCallback((value: number) => {
        live.current = value;
        rootRef.current?.style.setProperty(WIDTH_PROPERTY, `${value}px`);
    }, [rootRef]);

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0) {
            return;
        }

        // Otherwise the press also lands on whatever the handle overlaps, and
        // text either side of it gets selected as the pointer moves.
        event.preventDefault();

        drag.current = {
            pointerId : event.pointerId,
            startX    : event.clientX,
            startWidth: live.current
        };

        event.currentTarget.setPointerCapture(event.pointerId);
        rootRef.current?.classList.add(RESIZING_CLASS);
    }, [rootRef]);

    const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
        const current = drag.current;

        if (!current || current.pointerId !== event.pointerId) {
            return;
        }

        // The sidebar is the right-hand column, so its leading edge moving left
        // makes it wider — the pointer's delta is subtracted, not added.
        paint(clamp(current.startWidth - (event.clientX - current.startX)));
    }, [clamp, paint]);

    const endDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) {
            return;
        }

        drag.current = null;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        rootRef.current?.classList.remove(RESIZING_CLASS);

        // Now that the frames are over, let React catch up to where the DOM
        // already is, so the next render does not put the old width back.
        setWidth(live.current);
    }, [rootRef]);

    // A drag-only affordance cannot be reached without a pointer, and the
    // sidebar is a real layout control rather than decoration.
    const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
        const step =
            event.key === "ArrowLeft"  ?  KEY_STEP :
            event.key === "ArrowRight" ? -KEY_STEP : 0;

        if (!step) {
            return;
        }

        event.preventDefault();

        const next = clamp(live.current + step);

        paint(next);
        setWidth(next);
    }, [clamp, paint]);

    const onDoubleClick = useCallback(() => {
        const next = clamp(DEFAULT_WIDTH);

        paint(next);
        setWidth(next);
    }, [clamp, paint]);

    return {
        width,
        handleProps: {
            className        : "cp-timeline-chart-sidebar-handle",
            role             : "separator",
            "aria-orientation": "vertical" as const,
            "aria-label"     : "Resize sidebar",
            "aria-valuenow"  : Math.round(width),
            "aria-valuemin"  : MIN_WIDTH,
            tabIndex         : 0,
            onPointerDown,
            onPointerMove,
            onPointerUp      : endDrag,
            onPointerCancel  : endDrag,
            onKeyDown,
            onDoubleClick
        }
    };
}
