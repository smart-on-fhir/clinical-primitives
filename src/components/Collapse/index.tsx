import { useEffect, useRef, useState } from "react";
import './Collapse.scss';

/** Must match the height transition in Collapse.scss. */
const TRANSITION_DURATION = 200;

export function Collapse({
    children,
    label,
    open,
    onToggle,
}: {
    children: React.ReactNode,
    label: React.ReactNode,

    /** Drives the open state from outside. Omit to let the component own it. */
    open?: boolean,

    /** Called with the state the collapse is moving to, whether controlled or not. */
    onToggle?: (open: boolean) => void,
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

    const isOpen = open ?? uncontrolledOpen;
    const [height         , setHeight         ] = useState<string>('0px');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const contentRef                            = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;

        if (isOpen) {
            // Opening: set to measured height, then to auto after transition
            const measured = `${el.scrollHeight}px`;
            setHeight(measured);
            setIsTransitioning(true);

            // `transitionend` is not guaranteed: if the measured height happens
            // to equal the current one, nothing animates and no event fires.
            // That leaves the height pinned to a stale value, clipping anything
            // added later with no way to scroll to it — which is exactly what
            // happens when a body is filled in after opening, by a portal say.
            // So release to `auto` on a timer as well.
            const timer = window.setTimeout(() => {
                setHeight('auto');
                setIsTransitioning(false);
            }, TRANSITION_DURATION + 50);

            return () => window.clearTimeout(timer);
        } else {
            // Closing: from auto or current height -> measured -> 0
            const measured = `${el.scrollHeight}px`;
            // Force browser to register the measured height first
            setHeight(measured);
            // next tick collapse to 0
            requestAnimationFrame(() => requestAnimationFrame(() => {
                setHeight('0px');
                setIsTransitioning(true);
            }));
        }
    }, [isOpen]);

    function onTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
        // `transitionend` bubbles, so a nested collapse animating inside this one
        // would otherwise end this one's transition too — leaving it with a
        // stale fixed height that clips whatever sits below.
        if (event.target !== contentRef.current) {
            return;
        }

        if (isOpen) {
            setHeight('auto');
        }
        setIsTransitioning(false);
    }

    return (
        <div className={"cp-collapse" + (isOpen ? " open" : "")}>
            <div
                onClick={() => {
                    setUncontrolledOpen(!isOpen);
                    onToggle?.(!isOpen);
                }}
                className="cp-collapse-header"
            >
                <i className="cp-collapse-caret" />
                <div style={{ minWidth: 0, overflow: 'hidden' }}>{label}</div>
            </div>
            <div
                className="cp-collapse-content"
                ref={contentRef}
                onTransitionEnd={onTransitionEnd}
                style={{
                    overflow: isTransitioning ? 'hidden' : 'visible',
                    height: height,
                    opacity: isOpen || isTransitioning ? 1 : 0,
                }}
            >
                <div>{isOpen && children}</div>
            </div>
        </div>
    );
}
