import { useRef } from "react";
import { XIcon } from "lucide-react";
import { useSidebarResize } from "../TimelineChart/useSidebarResize";
import "./SidebarLayout.scss";

/**
 * Main content with a resizable sidebar on its right — the layout the timeline
 * chart uses for its details panel, for any page that needs one: a list with
 * the selected item's details beside it, say.
 *
 * The sidebar's column is always present and animates to nothing when closed,
 * so opening and closing slide rather than snap. Its left border is a drag
 * handle (arrow keys when focused, double-click to reset). The sidebar sticks
 * to the top of the nearest scroll container, so it stays in view while the
 * main content scrolls; set `--cp-sidebar-layout-max-height` on the layout if
 * that container is shorter than the viewport, and `--cp-sidebar-layout-top`
 * if something else is stuck to its top — no further down than the sidebar
 * already sits, or it shifts at rest. Space above the sidebar's content goes in
 * `--cp-sidebar-layout-padding-top`.
 *
 * The root and the main column are styled through data attributes rather than
 * `cp-` classes on purpose. The library's reset reaches every element inside
 * one carrying a `cp-` class, and being unlayered it beats a host's layered
 * utilities — so a `cp-` root would strip the padding and borders off every
 * Tailwind-styled element of the page it wraps. The main column is the app's,
 * not the library's; only the sidebar chrome is reset.
 */
export function SidebarLayout({
    open,
    sidebar,
    title,
    onClose,
    defaultWidth = 400,
    defaultFraction,
    minWidth = 288,
    maxFraction = 0.6,
    className,
    style,
    children
}: {
    /** Whether the sidebar is shown. */
    open: boolean,

    /** The sidebar's content. */
    sidebar: React.ReactNode,

    /** Heading at the top of the sidebar. Rendered only with `title` or `onClose`. */
    title?: React.ReactNode,

    /** Adds a close button to the sidebar header. */
    onClose?: () => void,

    /** Starting width in px, and the one a double-click on the handle returns to. */
    defaultWidth?: number,

    /**
     * Starting width as a share of the layout's width (0.4 for 40%), used in
     * place of `defaultWidth`. Measured when the layout mounts, not tracked as
     * the window resizes.
     */
    defaultFraction?: number,

    /** Narrowest the sidebar can be dragged, in px. */
    minWidth?: number,

    /**
     * The most of the layout's width the sidebar may take — while dragging,
     * and as the layout is resized. Set `--cp-sidebar-layout-max-width` on the
     * layout to cap it in other units.
     */
    maxFraction?: number,

    className?: string,

    style?: React.CSSProperties,

    /** The main content. */
    children: React.ReactNode
}) {
    const rootRef = useRef<HTMLDivElement>(null);

    const { width, handleProps } = useSidebarResize(rootRef, {
        defaultWidth,
        defaultFraction,
        minWidth,
        maxFraction,
        widthProperty: "--cp-sidebar-layout-width",
        resizingClass: "",
        handleClass  : "cp-sidebar-layout-handle"
    });

    return (
        <div
            ref={rootRef}
            data-cp-sidebar-layout=""
            data-open={open || undefined}
            className={className}
            // Re-stated on every render so React's value wins after a drag,
            // which wrote the same property straight to the node.
            style={{
                "--cp-sidebar-layout-max-width": `${maxFraction * 100}%`,
                ...style,
                "--cp-sidebar-layout-width": `${width}px`
            } as React.CSSProperties}
        >
            <div data-cp-sidebar-layout-main="">
                {children}
            </div>
            {/* Always mounted, so opening and closing can be animated. It is
                the grid column that collapses, not the element. */}
            <aside className="cp-sidebar-layout-sidebar" aria-hidden={!open}>
                <div {...handleProps} />
                <div className="cp-sidebar-layout-scroll">
                    { (title || onClose) &&
                        <div className="cp-sidebar-layout-header">
                            <div className="cp-sidebar-layout-title">{title}</div>
                            { onClose &&
                                <button className="cp-sidebar-layout-close" title="Close" onClick={onClose}>
                                    <XIcon size="1.25em" style={{ display: "block" }} />
                                </button> }
                        </div> }
                    {sidebar}
                </div>
            </aside>
        </div>
    );
}
