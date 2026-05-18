
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