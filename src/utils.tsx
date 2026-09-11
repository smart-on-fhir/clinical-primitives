import { ReactNode } from "react"

export function groupBy(data: Record<string, any>[], prop: string) {
    return data.reduce((acc, item) => {
        const key = String(item[prop] || 'undefined');
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<string, any[]>);
}

export function ellipsis(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

export function roundToPrecision(num: number, precision: number) {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
}

export function makeWrapperComponent(baseClass: string) {
    return function({
        children,
        className,
        ...props
    }: {
        children: React.ReactNode;
        className?: string
    } & React.HTMLAttributes<HTMLDivElement>) {
        return <div className={`${baseClass} ${className || ''}`} {...props}>{children}</div>;
    };
}

export function classList(classes: Record<string, boolean | undefined>): string {
    return Object.entries(classes)
        .filter(([_, value]) => !!value)
        .map(([key, _]) => key)
        .join(" ")
}

export function getPath(obj: Record<string, any>, path = ""): any {
    path = path.trim();
    if (!path) {
        return obj;
    }

    let segments = path.split(".");
    let result = obj;

    while (result && segments.length) {
        const key = segments.shift();
        if (!key && Array.isArray(result)) {
            return result.map(o => getPath(o, segments.join(".")));
        } else {
            result = result[key as string];
        }
    }

    return result;
}

export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Wraps every case-insensitive occurrence of `search` in `text` with a
 * `<mark>` so it can be styled (e.g. highlighted yellow). Returns `text`
 * unchanged if there's nothing to search for or no match.
 */
export function highlightText(text: string, search?: string): ReactNode {
    if (!search) return text;

    const lower = text.toLowerCase();
    const term  = search.toLowerCase();

    let start = 0;
    let index = lower.indexOf(term, start);
    if (index === -1) return text;

    const parts: ReactNode[] = [];
    let key = 0;

    while (index !== -1) {
        if (index > start) parts.push(text.slice(start, index));
        parts.push(<mark key={key++} className="cp-search-highlight">{text.slice(index, index + term.length)}</mark>);
        start = index + term.length;
        index = lower.indexOf(term, start);
    }
    if (start < text.length) parts.push(text.slice(start));

    return <>{parts}</>;
}
