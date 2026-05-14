import { formatDate } from "./utils";

interface DateDisplayProps extends Intl.DateTimeFormatOptions {
    date: string | Date;
}

export function DateDisplay({ date, ...options }: DateDisplayProps) {
    return (
        <span title={date ? date + "" : undefined}>
            { formatDate(date, { year: 'numeric', month: 'short', day: 'numeric', ...options }) }
        </span>
    );
}
