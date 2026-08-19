import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { renderTooltipMarkdown } from './markdown';
import {
    computePlacement,
    type Box,
    type Placement,
    type TooltipPosition,
    type TooltipX,
    type TooltipY
} from './position';
import './Tooltip.scss';

export type TooltipTrigger = 'mouseover' | 'click' | 'focus';

/**
 * What actually opened the tooltip this time, which is not the same thing as
 * its configured trigger: a `mouseover` tooltip also opens on focus, and only
 * the hover route should pay the open delay.
 */
type TooltipSource = 'hover' | 'click' | 'focus';

/**
 * Author-facing axis values. `pointer` makes that axis track the cursor instead
 * of the trigger's box, which is what a wide target — a timeline bar, a table
 * row, a map region — needs: anchoring to the middle of a bar that spans half
 * the screen points at a place the user is not looking.
 *
 * Only meaningful with the `mouseover` trigger; a click- or focus-opened
 * tooltip has no live cursor to follow and falls back to the axis default.
 */
export type TooltipAxisX = TooltipX | 'pointer';
export type TooltipAxisY = TooltipY | 'pointer';

export interface TooltipProps {
    /** Delay in ms before a hover tooltip appears. Overridden per element by `data-tooltip-delay`. */
    delay?: number;
    /** Gap in px between the anchor and the tooltip. Overridden by `data-tooltip-offset`. */
    offset?: number;
    /** Keeps the tooltip this far from the viewport edges. */
    viewportPadding?: number;
    /** Default max width of the bubble, as a CSS length. Overridden by `data-tooltip-max-width`. */
    maxWidth?: string;
}

interface ResolvedOptions {
    x        : TooltipAxisX;
    y        : TooltipAxisY;
    position : TooltipPosition;
    trigger  : TooltipTrigger;
    delay    : number;
    offset   : number;
    maxWidth : string;
    viewport : string | null;
    anchor   : string | null;
    className: string | null;
}

interface ActiveTooltip {
    target : HTMLElement;
    options: ResolvedOptions;
    /** Distinguishes a click-latched tooltip from a transient hover one. */
    latched: boolean;
}

// 8 rather than a prettier 6 so the rendered box — 1.5x this, see the
// stylesheet — is 12px and its `translate(-50%)` is a whole 6px. A 9px box
// translated by 4.5px puts the arrow's own center half a pixel off the grid
// before any of the placement math has run.
const ARROW_SIZE   = 8;

/**
 * How far the arrow's corners reach from its own center: it is drawn 1.5×
 * {@link ARROW_SIZE} (see the stylesheet) and rotated 45°, so the corners sit
 * half a diagonal out.
 */
const ARROW_REACH  = ARROW_SIZE * 1.5 * Math.SQRT2 / 2;

/**
 * The bubble's corner radius, `--cp-radius-md` in `styles/library.scss`.
 *
 * Duplicated from CSS, which is a wart — but the clamp that uses it runs in JS,
 * and a wrong value here is visible rather than silent: the arrow overlaps the
 * curve, which is exactly the bug this constant was added to fix.
 */
const BUBBLE_RADIUS = 6;

/**
 * Minimum clearance between the arrow's center and the bubble's corners.
 *
 * Has to clear the rounded corner *and* the arrow's own half-diagonal, or the
 * arrow's near corner lands on the curve and its bordered face meets the
 * bubble's border where that border is already turning — which no amount of
 * alignment can make read as one line. The previous flat 10 was 4.5px short.
 */
const ARROW_INSET  = Math.ceil(ARROW_REACH + BUBBLE_RADIUS);
const TOOLTIP_ID   = 'cp-tooltip';
// Referenced both in the render and imperatively in `update`, which must agree.
const GLIDE_CLASS  = 'cp-tooltip--glide';

function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
    return allowed.includes(value as T) ? (value as T) : fallback;
}

function numberOr(value: string | null | undefined, fallback: number): number {
    const parsed = Number(value);
    return value != null && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

function readOptions(el: HTMLElement, defaults: Required<TooltipProps>): ResolvedOptions {
    return {
        x        : oneOf(el.getAttribute('data-tooltip-x'), ['left', 'center', 'right', 'pointer'] as const, 'center'),
        y        : oneOf(el.getAttribute('data-tooltip-y'), ['top', 'middle', 'bottom', 'pointer'] as const, 'top'),
        position : oneOf(el.getAttribute('data-tooltip-position'), ['inside', 'outside'] as const, 'outside'),
        trigger  : oneOf(el.getAttribute('data-tooltip-trigger'), ['mouseover', 'click', 'focus'] as const, 'mouseover'),
        delay    : numberOr(el.getAttribute('data-tooltip-delay'), defaults.delay),
        offset   : numberOr(el.getAttribute('data-tooltip-offset'), defaults.offset),
        maxWidth : el.getAttribute('data-tooltip-max-width') || defaults.maxWidth,
        viewport : el.getAttribute('data-tooltip-viewport'),
        anchor   : el.getAttribute('data-tooltip-anchor'),
        className: el.getAttribute('data-tooltip-class')
    };
}

function rectToBox(rect: DOMRect): Box {
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/**
 * The region the tooltip must stay within: the window, or the element named by
 * `data-tooltip-viewport` clipped to the window so an off-screen container can
 * never push the tooltip out of sight.
 */
function resolveViewport(selector: string | null, padding: number): Box {
    const windowBox: Box = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    let box = windowBox;

    if (selector) {
        const el = document.querySelector(selector);

        if (el) {
            const rect = rectToBox(el.getBoundingClientRect());
            const left = Math.max(rect.left, windowBox.left);
            const top  = Math.max(rect.top, windowBox.top);

            box = {
                left,
                top,
                width : Math.min(rect.left + rect.width, windowBox.width) - left,
                height: Math.min(rect.top + rect.height, windowBox.height) - top
            };
        }
    }

    return {
        left  : box.left + padding,
        top   : box.top + padding,
        width : Math.max(0, box.width - padding * 2),
        height: Math.max(0, box.height - padding * 2)
    };
}

/**
 * Whether this tooltip tracks the cursor on either axis. Restricted to hover:
 * a click- or focus-opened tooltip has no cursor to follow, and pinning one to
 * wherever the mouse happens to rest would be arbitrary.
 */
function usesPointer(options: ResolvedOptions): boolean {
    return options.trigger === 'mouseover' && (options.x === 'pointer' || options.y === 'pointer');
}

/**
 * The element the tooltip positions against, which need not be the one that
 * triggered it. A chart tracking the cursor is the motivating case: the whole
 * plot is the trigger, but the bubble should point at the marker.
 *
 * Searched inside the trigger first so that several charts on one page each
 * resolve to their own marker rather than all matching the first in document
 * order; only then does it fall back to a document-wide lookup. A selector that
 * matches nothing leaves the trigger itself as the anchor.
 */
function resolveAnchorElement(target: HTMLElement, selector: string | null): Element {
    if (!selector) {
        return target;
    }

    return target.querySelector(selector) ?? document.querySelector(selector) ?? target;
}

/**
 * Resolve `pointer` axes into plain geometry.
 *
 * A pointer axis collapses the anchor to a zero-size point at the cursor, and
 * asks for the axis default around it. That keeps the placement math free of
 * any notion of a pointer: aligning, flipping and clamping all still operate on
 * a box, and a cursor is simply a box with no extent.
 */
function resolveAnchor(
    element: Element,
    options: ResolvedOptions,
    pointer: { x: number; y: number } | null
): { anchor: Box; x: TooltipX; y: TooltipY } {
    const anchor = rectToBox(element.getBoundingClientRect());
    const usable = pointer && usesPointer(options);

    if (usable && options.x === 'pointer') {
        anchor.left  = pointer.x;
        anchor.width = 0;
    }

    if (usable && options.y === 'pointer') {
        anchor.top    = pointer.y;
        anchor.height = 0;
    }

    return {
        anchor,
        // Centering on the cursor is what "follow the pointer" means on the
        // horizontal; vertically the tooltip still sits clear of it, above.
        x: options.x === 'pointer' ? 'center' : options.x,
        y: options.y === 'pointer' ? 'top'    : options.y
    };
}

/**
 * Rounds a CSS pixel value onto the device's pixel grid.
 *
 * The bubble's border box is pixel-snapped when it is painted, while the arrow
 * carries a `transform` and so is rasterized with subpixel precision. Left
 * fractional, the two are displaced from each other by whatever the snapping
 * moved — an error that varies with the bubble's content and its scroll
 * position, which is why no constant nudge in the stylesheet could cancel it.
 * Landing the bubble on the grid in the first place leaves the snapping nothing
 * to do, and the arrow's offsets then mean what they say.
 */
function snapToPixel(value: number): number {
    const ratio = window.devicePixelRatio || 1;
    return Math.round(value * ratio) / ratio;
}

function samePlacement(a: Placement | null, b: Placement): boolean {
    return !!a
        && Math.abs(a.left - b.left) < 0.5
        && Math.abs(a.top - b.top) < 0.5
        && a.side === b.side
        && Math.abs((a.arrow?.offset ?? 0) - (b.arrow?.offset ?? 0)) < 0.5;
}

/**
 * Global tooltip layer. Render it once, near the root of the app; every element
 * carrying `data-tooltip` anywhere on the page is then handled by delegation,
 * including elements rendered outside React.
 *
 * Because it portals into `document.body`, tooltips escape `overflow: hidden`
 * and stacking contexts of their triggers.
 */
export function Tooltip({
    delay           = 100,
    offset          = 10,
    viewportPadding = 8,
    maxWidth        = '20rem'
}: TooltipProps = {}) {
    const defaults: Required<TooltipProps> = { delay, offset, viewportPadding, maxWidth };
    const defaultsRef = useRef(defaults);
    defaultsRef.current = defaults;

    const [active, setActive]       = useState<ActiveTooltip | null>(null);
    const [placement, setPlacement] = useState<Placement | null>(null);
    // Held apart from `active` on purpose: content can change while a tooltip
    // stays open on the same anchor, and folding it into `active` would tear
    // down and re-attach every observer on each change.
    const [content, setContent]     = useState<ReactNode>(null);
    // Whether the current left/top change animates. Decided per reposition by
    // `update`, not per tooltip: only a move the anchor itself initiated earns
    // easing. Opening, scrolling, resizing and cursor-tracking all jump.
    const [glide, setGlide]         = useState(false);

    const bubbleRef  = useRef<HTMLDivElement>(null);
    const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Read inside document-level listeners, which are registered once and must
    // not close over a stale `active`.
    const activeRef  = useRef<ActiveTooltip | null>(null);
    activeRef.current = active;
    // The anchor whose open delay is currently counting down. Tracked so that
    // moving across the anchor's own children neither cancels nor restarts it.
    const pendingRef = useRef<HTMLElement | null>(null);
    // Last known cursor position, for `pointer` axes. Recorded from the moment
    // the trigger is entered, so a delayed tooltip already knows where the
    // cursor is when it finally opens.
    const pointerRef = useRef<{ x: number; y: number } | null>(null);

    const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current = null;
    }, []);

    const hide = useCallback(() => {
        clearTimer();
        setActive(null);
        setPlacement(null);
    }, [clearTimer]);

    const show = useCallback((target: HTMLElement, source: TooltipSource) => {
        clearTimer();

        const content = renderTooltipMarkdown(target.getAttribute('data-tooltip') || '');

        // An empty `data-tooltip` shows nothing, and must also dismiss whatever
        // was open rather than leaving a stale bubble behind.
        if (content === null) {
            hide();
            return;
        }

        const options = readOptions(target, defaultsRef.current);
        const commit  = () => {
            timerRef.current   = null;
            pendingRef.current = null;
            // Clicking a second trigger while one is latched swaps the anchor
            // without unmounting the bubble, so a glide left over from the old
            // one would animate this reset to 0,0 as a slide to the corner.
            setGlide(false);
            setPlacement(null);
            setContent(content);
            setActive({ target, options, latched: source === 'click' });
        };

        // Click and keyboard focus are explicit user intent, so they open
        // immediately. Only hover pays the delay, whose job is to keep the
        // tooltip from flashing as the pointer crosses a trigger on its way
        // somewhere else — a problem no deliberate open has.
        if (source !== 'hover' || options.delay <= 0) {
            commit();
        }
        else {
            pendingRef.current = target;
            timerRef.current   = setTimeout(commit, options.delay);
        }
    }, [clearTimer, hide]);

    /**
     * Recompute the position against the anchor's current box.
     *
     * `animate` glides the bubble to the new spot instead of jumping there, and
     * belongs to the *cause* of the move rather than to the tooltip: a bubble
     * hopping between chart markers wants easing, the same bubble riding a
     * scroll wants to be welded to its anchor. Set alongside the placement so
     * both land in one render — a transition declared in the same style
     * recalculation as the change it covers still animates.
     */
    const update = useCallback((animate = false) => {
        const current = activeRef.current;
        const bubble  = bubbleRef.current;

        if (!current || !bubble) {
            return;
        }

        // The anchor may have been unmounted while the tooltip was open.
        if (!current.target.isConnected) {
            hide();
            return;
        }

        // Re-resolved on every reposition, so a marker that moves, is replaced,
        // or disappears is picked up without any registration step.
        const anchorElement = resolveAnchorElement(current.target, current.options.anchor);

        const { anchor, x, y } = resolveAnchor(anchorElement, current.options, pointerRef.current);

        // Measured with getBoundingClientRect, not offsetWidth/offsetHeight:
        // those round to whole pixels, and the arrow is positioned at exactly
        // the measured height. A bubble 27.6px tall reports 28, putting the
        // arrow 0.4px past the edge it is supposed to sit on — which shows up
        // as the arrow's borders stepping away from the bubble's. The error
        // depends on the fractional part of the height, so identical tooltips
        // on one page look fine or misaligned depending on their content.
        const rect = bubble.getBoundingClientRect();

        const placed = computePlacement({
            anchor,
            x,
            y,
            tooltip   : { width: rect.width, height: rect.height },
            viewport  : resolveViewport(current.options.viewport, defaultsRef.current.viewportPadding),
            position  : current.options.position,
            offset    : current.options.offset,
            arrowInset: ARROW_INSET
        });

        // Snapped here rather than inside computePlacement, which is a pure
        // geometry function and has no business knowing about a display. Both
        // the imperative write below and the React render read these, so they
        // have to agree on the rounded values, not just the raw ones.
        const next: Placement = {
            ...placed,
            left : snapToPixel(placed.left),
            top  : snapToPixel(placed.top),
            arrow: placed.arrow && { offset: snapToPixel(placed.arrow.offset) }
        };

        // Never while tracking the cursor: there the bubble is already moving
        // with the pointer, and easing only turns that into lag.
        const easing = animate && !usesPointer(current.options);

        if (easing) {
            // Left to React, so the transition and the coordinates it animates
            // arrive in one commit — a frame of latency is invisible under a
            // 0.2s ease anyway.
            setGlide(true);
        }
        else {
            setGlide(false);

            // Dropped synchronously, not just via the state above: the write
            // below happens now, while a `--glide` left over from a previous
            // anchor move is still on the element, and the stylesheet would
            // animate it. That is the transition reappearing on scroll. React
            // is already heading to the same class list, so this only brings
            // the removal forward to where it is needed.
            bubble.classList.remove(GLIDE_CLASS);

            // Written straight to the node rather than waiting for the render.
            // Scroll events are dispatched inside the frame's rendering steps,
            // so a synchronous write here is painted with the scroll that
            // caused it, while a setState lands a frame or more later — the
            // bubble visibly trailing the anchor and then catching up. Same
            // for the rAF-driven pointer and anchor updates. The state below
            // still runs, re-rendering these exact numbers and carrying the
            // side class and arrow offsets.
            bubble.style.left = `${next.left}px`;
            bubble.style.top  = `${next.top}px`;

            if (next.arrow) {
                bubble.style.setProperty('--cp-tooltip-arrow-offset', `${next.arrow.offset}px`);
            }
        }

        setPlacement(previous => (samePlacement(previous, next) ? previous : next));
    }, [hide]);

    // --- Trigger delegation --------------------------------------------------
    // One set of document-level listeners covers the whole page, so triggers can
    // appear and disappear freely without any registration step.
    useEffect(() => {
        const findTrigger = (node: EventTarget | null): HTMLElement | null =>
            node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null;

        const onPointerOver = (event: PointerEvent) => {
            const trigger = findTrigger(event.target);
            const current = activeRef.current;

            // Recorded before the early returns below: a tooltip that opens
            // after a delay still needs the cursor position from entry.
            pointerRef.current = { x: event.clientX, y: event.clientY };

            if (!trigger) {
                // Left the trigger for unrelated content; drop transient tooltips
                // and abandon any tooltip still waiting on its delay.
                if (!bubbleRef.current?.contains(event.target as Node)) {
                    if (pendingRef.current) {
                        clearTimer();
                    }
                    if (current && !current.latched) {
                        hide();
                    }
                }
                return;
            }

            if (readOptions(trigger, defaultsRef.current).trigger !== 'mouseover') {
                return;
            }

            // Already shown for this anchor, or already counting down for it.
            // Re-entering via a child element must not restart the delay.
            if (current?.target === trigger || pendingRef.current === trigger) {
                return;
            }

            show(trigger, 'hover');
        };

        const onPointerOut = (event: PointerEvent) => {
            const current = activeRef.current;

            if (!current || current.latched) {
                return;
            }

            const to = event.relatedTarget as Node | null;

            // Ignore moves within the anchor, and let the pointer travel onto the
            // bubble itself so selectable tooltip text stays reachable.
            if (to && (current.target.contains(to) || bubbleRef.current?.contains(to))) {
                return;
            }

            if (current.target.contains(event.target as Node)) {
                hide();
            }
        };

        const onClick = (event: MouseEvent) => {
            const trigger = findTrigger(event.target);
            const current = activeRef.current;

            if (bubbleRef.current?.contains(event.target as Node)) {
                return;
            }

            if (trigger && readOptions(trigger, defaultsRef.current).trigger === 'click') {
                if (current?.target === trigger && current.latched) {
                    hide();
                }
                else {
                    show(trigger, 'click');
                }
                return;
            }

            // A click anywhere else dismisses a latched tooltip.
            if (current?.latched) {
                hide();
            }
        };

        const onFocusIn = (event: FocusEvent) => {
            const trigger = findTrigger(event.target);

            if (!trigger) return;

            // Keyboard users reach hover tooltips through focus too, so both
            // triggers respond here; only `click` stays pointer-driven.
            if (readOptions(trigger, defaultsRef.current).trigger !== 'click') {
                show(trigger, 'focus');
            }
        };

        const onFocusOut = (event: FocusEvent) => {
            const current = activeRef.current;

            if (current && !current.latched && current.target.contains(event.target as Node)) {
                hide();
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && activeRef.current) {
                hide();
            }
        };

        document.addEventListener('pointerover', onPointerOver);
        document.addEventListener('pointerout', onPointerOut);
        document.addEventListener('click', onClick);
        document.addEventListener('focusin', onFocusIn);
        document.addEventListener('focusout', onFocusOut);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerover', onPointerOver);
            document.removeEventListener('pointerout', onPointerOut);
            document.removeEventListener('click', onClick);
            document.removeEventListener('focusin', onFocusIn);
            document.removeEventListener('focusout', onFocusOut);
            document.removeEventListener('keydown', onKeyDown);
            clearTimer();
        };
    }, [show, hide, clearTimer]);

    // --- Follow the anchor ---------------------------------------------------
    useLayoutEffect(() => {
        if (!active) {
            return;
        }

        // The opening placement, and every move the tooltip does not initiate:
        // a scroll or resize is the anchor being carried somewhere by the user,
        // and the bubble has to stay welded to it rather than easing after it.
        const reposition = () => update();

        reposition();

        // Capture phase catches scrolling in any ancestor container, not just
        // the window.
        window.addEventListener('scroll', reposition, { capture: true, passive: true });
        window.addEventListener('resize', reposition, { passive: true });

        const resizeObserver = new ResizeObserver(reposition);
        resizeObserver.observe(active.target);

        if (bubbleRef.current) {
            // Content reflow (fonts loading, wrapping changes) moves the bubble.
            resizeObserver.observe(bubbleRef.current);
        }

        // Catches an anchor removed while the tooltip is open without any scroll
        // or resize to prompt a recheck. Scoped to the tooltip's lifetime.
        const mutationObserver = new MutationObserver(() => {
            if (!activeRef.current?.target.isConnected) {
                hide();
            }
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });

        // An anchor may rewrite its own `data-tooltip` while the tooltip is
        // showing — a chart tracking the nearest point to the cursor keeps one
        // anchor and changes what it describes. Without this the bubble would
        // keep displaying whatever was true when the pointer first arrived.
        const contentObserver = new MutationObserver(() => {
            const next = renderTooltipMarkdown(active.target.getAttribute('data-tooltip') || '');

            if (next === null) {
                hide();
                return;
            }

            setContent(next);
        });
        contentObserver.observe(active.target, { attributes: true, attributeFilter: ['data-tooltip'] });

        // A separate anchor element moves on its own schedule — React rewriting
        // a marker's coordinates is neither a scroll nor a resize, so nothing
        // else here would notice. Watching the trigger's subtree covers the
        // marker moving, being replaced, or being removed entirely.
        let anchorFrame = 0;

        const scheduleUpdate = () => {
            if (!anchorFrame) {
                anchorFrame = requestAnimationFrame(() => {
                    anchorFrame = 0;
                    // The one reposition worth animating: the anchor jumped to
                    // a new place on its own — a chart marker snapping between
                    // data points — so the bubble glides after it instead of
                    // teleporting.
                    update(true);
                });
            }
        };

        const anchorObserver = active.options.anchor ? new MutationObserver(scheduleUpdate) : null;

        anchorObserver?.observe(active.target, { attributes: true, childList: true, subtree: true });

        // Only a pointer-tracking tooltip cares about cursor movement; every
        // other one is pinned to its anchor and would just be recomputing the
        // same placement on every mouse move.
        let frame = 0;

        const onPointerMove = (event: PointerEvent) => {
            pointerRef.current = { x: event.clientX, y: event.clientY };

            // Coalesced to one reposition per frame. pointermove fires far
            // faster than the display refreshes, and each update runs layout
            // measurement plus a React render.
            if (!frame) {
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    update();
                });
            }
        };

        if (usesPointer(active.options)) {
            document.addEventListener('pointermove', onPointerMove, { passive: true });
        }

        return () => {
            window.removeEventListener('scroll', reposition, { capture: true });
            window.removeEventListener('resize', reposition);
            document.removeEventListener('pointermove', onPointerMove);
            if (frame) {
                cancelAnimationFrame(frame);
            }
            resizeObserver.disconnect();
            mutationObserver.disconnect();
            contentObserver.disconnect();
            anchorObserver?.disconnect();
            if (anchorFrame) {
                cancelAnimationFrame(anchorFrame);
            }
        };
    }, [active, update, hide]);

    // Point assistive tech at the bubble while it is open.
    useEffect(() => {
        const target = active?.target;

        if (!target || !placement) {
            return;
        }

        const previous = target.getAttribute('aria-describedby');
        target.setAttribute('aria-describedby', TOOLTIP_ID);

        return () => {
            if (previous === null) {
                target.removeAttribute('aria-describedby');
            }
            else {
                target.setAttribute('aria-describedby', previous);
            }
        };
    }, [active, placement]);

    if (!active) {
        return null;
    }

    const className = [
        'cp-tooltip',
        active.options.position === 'inside' ? 'cp-tooltip--inside' : `cp-tooltip--${placement?.side ?? 'top'}`,
        placement ? 'cp-tooltip--visible' : null,
        glide ? GLIDE_CLASS : null,
        // Only click-latched tooltips accept the pointer; hover ones stay
        // transparent to it so they cannot flicker or block the anchor.
        active.latched ? 'cp-tooltip--interactive' : null,
        active.options.className
    ].filter(Boolean).join(' ');

    return createPortal(
        <div
            id={TOOLTIP_ID}
            ref={bubbleRef}
            role="tooltip"
            className={className}
            style={{
                // Rendered off-placement for the first measuring pass, then
                // moved into position once the size is known.
                left            : placement?.left ?? 0,
                top             : placement?.top ?? 0,
                maxWidth        : active.options.maxWidth,
                '--cp-tooltip-arrow-offset': `${placement?.arrow?.offset ?? 0}px`,
                '--cp-tooltip-arrow-size'  : `${ARROW_SIZE}px`
            } as React.CSSProperties}
        >
            <div className="cp-tooltip-content">{content}</div>
            {placement?.arrow && <span className="cp-tooltip-arrow" aria-hidden="true" />}
        </div>,
        document.body
    );
}

export { renderTooltipMarkdown, escapeTooltipMarkdown } from './markdown';
export { computePlacement, resolveSideAlign } from './position';
export type { Placement, TooltipPosition, TooltipX, TooltipY, TooltipSide, TooltipAlign } from './position';
