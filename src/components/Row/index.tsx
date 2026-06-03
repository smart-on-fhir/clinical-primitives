import type { CSSProperties, ReactNode, HTMLAttributes } from "react";
import "./Row.scss";

export function Row({
    children,
    className,
    cols,
    style,
    ...props
}: {
    children: ReactNode;
    className?: string;
    cols?: string;
} & HTMLAttributes<HTMLDivElement>) {
    const resolvedStyle: CSSProperties | undefined = cols
        ? { display: 'grid', gridTemplateColumns: cols, ...style }
        : style;
    return (
        <div className={`cp-row ${className || ''}`} style={resolvedStyle} {...props}>
            {children}
        </div>
    );
}
