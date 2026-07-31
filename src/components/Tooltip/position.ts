/**
 * Pure geometry for tooltip placement. No DOM access here so the logic stays
 * testable and cheap to re-run on every scroll/resize frame.
 */

export type TooltipX        = 'left' | 'center' | 'right';
export type TooltipY        = 'top' | 'middle' | 'bottom';
export type TooltipPosition = 'inside' | 'outside';
export type TooltipSide     = 'top' | 'bottom' | 'left' | 'right';
export type TooltipAlign    = 'start' | 'center' | 'end';

export interface Box {
    left  : number;
    top   : number;
    width : number;
    height: number;
}

export interface PlacementInput {
    /** Trigger element box, in viewport coordinates. */
    anchor  : Box;
    /** Measured tooltip size. */
    tooltip : { width: number; height: number };
    /** Region the tooltip must stay inside, in viewport coordinates. */
    viewport: Box;
    x       : TooltipX;
    y       : TooltipY;
    position: TooltipPosition;
    /** Gap between anchor and tooltip (outside) or inset from the edge (inside). */
    offset  : number;
    /** Minimum clearance between the arrow and the bubble's corners. */
    arrowInset: number;
}

export interface Placement {
    left : number;
    top  : number;
    /** `null` when the tooltip is drawn inside the anchor (no arrow then). */
    side : TooltipSide | null;
    align: TooltipAlign;
    /** Arrow offset relative to the tooltip's own top-left corner. */
    arrow: { left: number; top: number } | null;
}

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
    top   : 'bottom',
    bottom: 'top',
    left  : 'right',
    right : 'left'
};

/** The two sides perpendicular to `side`, used as second-choice flip targets. */
const PERPENDICULAR: Record<TooltipSide, TooltipSide[]> = {
    top   : ['right', 'left'],
    bottom: ['right', 'left'],
    left  : ['bottom', 'top'],
    right : ['bottom', 'top']
};

/**
 * The arrow snaps to one of these fractions along the bubble's edge rather than
 * sliding continuously with the anchor. Quarter positions still communicate
 * which side of the bubble the anchor is on, without letting the arrow drift
 * into the rounded corners.
 */
export const ARROW_SNAP_FRACTIONS = [0.05, 0.5, 0.95];

/**
 * Pick the snap position nearest to where the anchor's center actually falls.
 *
 * Corner clearance is applied by clamping, not by discarding: a fraction close
 * to 0 or 1 is pulled in to `inset` rather than dropped, so the outer positions
 * keep working on bubbles too small for them to fit literally. Discarding
 * instead would silently collapse every arrow to the midpoint whenever the
 * fractions sit nearer the edge than `inset` — the setting would appear to do
 * nothing.
 */
function snapArrow(ideal: number, size: number, inset: number): number {
    // No room for an off-center arrow that still clears both corners.
    if (inset * 2 >= size) {
        return size / 2;
    }

    return ARROW_SNAP_FRACTIONS
        .map(fraction => clamp(size * fraction, inset, size - inset))
        .reduce((best, candidate) =>
            Math.abs(candidate - ideal) < Math.abs(best - ideal) ? candidate : best
        );
}

function clamp(value: number, min: number, max: number): number {
    // When the tooltip is larger than the viewport, min > max; prefer the min
    // edge so the start of the content stays readable.
    return max < min ? min : Math.min(Math.max(value, min), max);
}

/**
 * Translate the author-facing x/y grid into the side + align pair that the flip
 * logic works with. For `outside`, the axis with a non-center value decides
 * which edge of the anchor we sit against.
 */
export function resolveSideAlign(x: TooltipX, y: TooltipY): { side: TooltipSide; align: TooltipAlign } {
    if (y === 'top' || y === 'bottom') {
        return {
            side : y,
            align: x === 'left' ? 'start' : x === 'right' ? 'end' : 'center'
        };
    }

    // y === 'middle' -> sit to the left/right of the anchor. Dead center is
    // degenerate (the tooltip would cover the anchor), so fall back to 'top'.
    if (x === 'left' || x === 'right') {
        return { side: x, align: 'center' };
    }

    return { side: 'top', align: 'center' };
}

function alignAxis(start: number, size: number, tooltipSize: number, align: TooltipAlign): number {
    if (align === 'start') return start;
    if (align === 'end')   return start + size - tooltipSize;
    return start + size / 2 - tooltipSize / 2;
}

function outsideRect(
    side   : TooltipSide,
    align  : TooltipAlign,
    anchor : Box,
    tooltip: { width: number; height: number },
    offset : number
): Box {
    const size = { width: tooltip.width, height: tooltip.height };

    switch (side) {
        case 'top':
            return { ...size, top: anchor.top - tooltip.height - offset, left: alignAxis(anchor.left, anchor.width, tooltip.width, align) };
        case 'bottom':
            return { ...size, top: anchor.top + anchor.height + offset, left: alignAxis(anchor.left, anchor.width, tooltip.width, align) };
        case 'left':
            return { ...size, left: anchor.left - tooltip.width - offset, top: alignAxis(anchor.top, anchor.height, tooltip.height, align) };
        case 'right':
            return { ...size, left: anchor.left + anchor.width + offset, top: alignAxis(anchor.top, anchor.height, tooltip.height, align) };
    }
}

/** Free space between the anchor edge and the viewport edge on the given side. */
function spaceOn(side: TooltipSide, anchor: Box, viewport: Box): number {
    switch (side) {
        case 'top'   : return anchor.top - viewport.top;
        case 'bottom': return viewport.top + viewport.height - (anchor.top + anchor.height);
        case 'left'  : return anchor.left - viewport.left;
        case 'right' : return viewport.left + viewport.width - (anchor.left + anchor.width);
    }
}

function neededOn(side: TooltipSide, tooltip: { width: number; height: number }, offset: number): number {
    return (side === 'top' || side === 'bottom' ? tooltip.height : tooltip.width) + offset;
}

export function computePlacement(input: PlacementInput): Placement {
    const { anchor, tooltip, viewport, x, y, position, offset, arrowInset } = input;

    const minLeft = viewport.left;
    const maxLeft = viewport.left + viewport.width - tooltip.width;
    const minTop  = viewport.top;
    const maxTop  = viewport.top + viewport.height - tooltip.height;

    if (position === 'inside') {
        const left = clamp(
            x === 'left'  ? anchor.left + offset :
            x === 'right' ? anchor.left + anchor.width - tooltip.width - offset :
                            anchor.left + anchor.width / 2 - tooltip.width / 2,
            minLeft, maxLeft
        );

        const top = clamp(
            y === 'top'    ? anchor.top + offset :
            y === 'bottom' ? anchor.top + anchor.height - tooltip.height - offset :
                             anchor.top + anchor.height / 2 - tooltip.height / 2,
            minTop, maxTop
        );

        return { left, top, side: null, align: 'center', arrow: null };
    }

    const { side: preferredSide, align } = resolveSideAlign(x, y);

    // Try the requested side first, then its opposite, then the perpendiculars.
    // The first one with enough room on its main axis wins; if nothing fits we
    // fall back to whichever side has the most room and let clamping handle it.
    const candidates = [preferredSide, OPPOSITE[preferredSide], ...PERPENDICULAR[preferredSide]];

    let side = candidates.find(
        candidate => spaceOn(candidate, anchor, viewport) >= neededOn(candidate, tooltip, offset)
    );

    if (!side) {
        side = candidates.reduce((best, candidate) =>
            spaceOn(candidate, anchor, viewport) - neededOn(candidate, tooltip, offset) >
            spaceOn(best,      anchor, viewport) - neededOn(best,      tooltip, offset) ? candidate : best
        );
    }

    // A flip onto a perpendicular side invalidates the original align (it was
    // expressed on the other axis), so re-center it there.
    const flippedAxis =
        (preferredSide === 'top' || preferredSide === 'bottom') !== (side === 'top' || side === 'bottom');

    const effectiveAlign = flippedAxis ? 'center' : align;

    const rect = outsideRect(side, effectiveAlign, anchor, tooltip, offset);
    const left = clamp(rect.left, minLeft, maxLeft);
    const top  = clamp(rect.top,  minTop,  maxTop);

    // Aim at the anchor's center, then snap to the nearest quarter position.
    const arrow = side === 'top' || side === 'bottom'
        ? {
            left: snapArrow(anchor.left + anchor.width / 2 - left, tooltip.width, arrowInset),
            top : side === 'top' ? tooltip.height : 0
        }
        : {
            left: side === 'left' ? tooltip.width : 0,
            top : snapArrow(anchor.top + anchor.height / 2 - top, tooltip.height, arrowInset)
        };

    return { left, top, side, align: effectiveAlign, arrow };
}
