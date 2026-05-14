/**
 * Converts a date string into a more readable format.
 * @param dateStr - Any valid date string that can be parsed by the Date constructor.
 * @returns A locally formatted date string
 */
export function formatDate(
    dateStr: string | Date | undefined,
    options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
    if (!dateStr) return '—';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr instanceof Date ? dateStr.toString() : dateStr;
        return date.toLocaleDateString(undefined, { year: options.year, month: options.month, day: options.day });
    } catch (e) {
        return dateStr instanceof Date ? dateStr.toString() : dateStr;
    }
}