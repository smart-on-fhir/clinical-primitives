import { useRef, useState } from "react";
import { useTimelineChartContext } from "./TimelineChartContext";

/** How far the pointer must travel before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 3;

type Drag = {
    pointerId : number,
    startX    : number,
    width     : number,
    rangeStart: number,
    rangeEnd  : number,
    moved     : boolean
};

/**
 * Drag-to-pan for a section's content area. Returns props to spread onto the
 * element that should be draggable — `TimelineChartLayer` puts them on the
 * content cell only, so headers and labels are not pan targets.
 */
export function usePan() {
    const { visibleRangeStart, visibleRangeEnd, setVisibleRange } = useTimelineChartContext();

    const [panning, setPanning] = useState(false);

    const drag = useRef<Drag | null>(null);

    // Survives past pointerup so the click that follows a drag can be swallowed
    // before it reaches whatever was underneath (a bar, say).
    const dragged = useRef(false);

    function onPointerDown(event: React.PointerEvent<HTMLElement>) {
        if (event.button !== 0) {
            return;
        }

        const width = event.currentTarget.getBoundingClientRect().width;

        if (!width) {
            return;
        }

        dragged.current = false;

        // The visible range is captured once, at the start of the drag, and every
        // subsequent move is measured against it. Applying deltas to the current
        // range instead would accumulate rounding error over a long drag.
        drag.current = {
            pointerId : event.pointerId,
            startX    : event.clientX,
            width,
            rangeStart: visibleRangeStart,
            rangeEnd  : visibleRangeEnd,
            moved     : false
        };

        // Note that the pointer is deliberately NOT captured here. Capturing
        // retargets pointerdown/pointerup to this element, and the browser
        // derives the click target from those — so capturing on press would stop
        // clicks from ever reaching the marks inside. Capture is taken in
        // onPointerMove instead, once the press is known to be a drag.
    }

    function onPointerMove(event: React.PointerEvent<HTMLElement>) {
        const state = drag.current;

        if (!state || state.pointerId !== event.pointerId) {
            return;
        }

        const dx = event.clientX - state.startX;

        if (!state.moved) {
            if (Math.abs(dx) < DRAG_THRESHOLD) {
                return;
            }
            state.moved = true;
            dragged.current = true;
            setPanning(true);

            // Now that this is a drag rather than a click, take the pointer so
            // it keeps tracking once it leaves the element.
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        // Dragging right moves the content right, which means looking further back.
        const delta = -dx / state.width * (state.rangeEnd - state.rangeStart);

        setVisibleRange(state.rangeStart + delta, state.rangeEnd + delta);
    }

    function onPointerUp(event: React.PointerEvent<HTMLElement>) {
        const state = drag.current;

        if (!state || state.pointerId !== event.pointerId) {
            return;
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        drag.current = null;
        setPanning(false);
    }

    // Until the threshold is crossed there is no pointer capture, so a press
    // that leaves the element would never deliver its pointerup here and the
    // drag would be left dangling. Once panning has started capture is active
    // and this no longer fires.
    function onPointerLeave() {
        if (drag.current && !drag.current.moved) {
            drag.current = null;
        }
    }

    function onClickCapture(event: React.MouseEvent<HTMLElement>) {
        if (dragged.current) {
            dragged.current = false;
            event.stopPropagation();
            event.preventDefault();
        }
    }

    return {
        panning,
        panProps: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onPointerLeave,
            onClickCapture
        }
    };
}
