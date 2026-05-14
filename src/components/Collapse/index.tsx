import { useEffect, useRef, useState } from "react";
import './Collapse.scss';

export function Collapse({
    children,
    label,
}: {
    children: React.ReactNode,
    label: React.ReactNode,
}) {
    const [isOpen         , setIsOpen         ] = useState(false);
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

    function onTransitionEnd() {
        if (isOpen) {
            setHeight('auto');
        }
        setIsTransitioning(false);
    }

    return (
        <div className={"cp-collapse" + (isOpen ? " open" : "")}>
            <div onClick={() => setIsOpen((v) => !v)} className="cp-collapse-header">
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
