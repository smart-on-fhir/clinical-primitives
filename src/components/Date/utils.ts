/**
 * Dates from FHIR resources, turned into text.
 *
 * FHIR `date` values ("2024-01-01", and partial "2024-01" or "2024") name a
 * calendar day, month or year with no time zone. `new Date()` parses them as
 * UTC midnight, which is fine for sorting and arithmetic, but formatting that
 * instant in local time shows the previous day anywhere west of UTC ("Dec 31,
 * 2023"), and a partial "2024-03" shows as "Feb 29, 2024". So date-only values
 * are formatted in UTC, at the precision they were given in; `dateTime` values,
 * which are real instants, are formatted in local time as before.
 */

const DAY_MS = 86_400_000;

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`: a FHIR date with no time part. */
const DATE_ONLY = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * Whether a value names a day (or month, or year) rather than a moment.
 *
 * Read from the string's shape when there is one. A `Date` has lost that, so
 * an exact UTC midnight stands in for it, as `formatPeriod` in the medication
 * timeline does: date-only values parse to exactly that, and dateTimes almost
 * never land on it. A dateTime that does is shown without its time, which is
 * harmless.
 */
function isDateOnly(value: string | Date): boolean {
    return typeof value === 'string'
        ? DATE_ONLY.test(value.trim())
        : value.getTime() % DAY_MS === 0;
}

/**
 * A FHIR date or dateTime as local display text, `—` when absent.
 *
 * `options` picks the fields (default: year, short month, day). A partial date
 * drops the fields it doesn't have: "2019" is "2019" and "2024-03" is "Mar 2024"
 * whatever `day` asks for. An unparseable string comes back as given.
 */
export function formatFhirDate(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
    if (!value) return '—';

    const fields: Intl.DateTimeFormatOptions = { year: options.year, month: options.month, day: options.day };

    if (typeof value === 'string') {
        const match = DATE_ONLY.exec(value.trim());
        if (match) {
            const [, year, month, day] = match;
            const utc = new Date(Date.UTC(Number(year), month ? Number(month) - 1 : 0, day ? Number(day) : 1));
            return utc.toLocaleDateString(undefined, {
                timeZone: 'UTC',
                year    : fields.year ?? 'numeric',
                month   : month ? fields.month : undefined,
                day     : month && day ? fields.day : undefined
            });
        }
    }

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString(undefined, isDateOnly(date) ? { ...fields, timeZone: 'UTC' } : fields);
}

/**
 * Like {@link formatFhirDate}, plus the time of day for a value that has one:
 * "Jan 1, 2024, 2:30 PM" for a dateTime, "Jan 1, 2024" or "Mar 2024" for a date.
 * For places where readings on the same day need telling apart.
 */
export function formatFhirDateTime(value: string | Date | null | undefined): string {
    if (!value || isDateOnly(value)) return formatFhirDate(value);

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * A FHIR date or dateTime as a `Date` for local-calendar code: day grouping,
 * "today"/"yesterday", time-of-day display. A date-only value becomes local
 * midnight of the day it names, where `new Date()` would give UTC midnight, the
 * evening before west of UTC. A dateTime parses as usual. Null if unparseable.
 */
export function parseFhirDateLocal(value: string): Date | null {
    const match = DATE_ONLY.exec(value.trim());
    if (match) {
        const [, year, month, day] = match;
        return new Date(Number(year), month ? Number(month) - 1 : 0, day ? Number(day) : 1);
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Converts a date string into a more readable format.
 * @param dateStr - A FHIR date or dateTime, or a `Date`; see {@link formatFhirDate}.
 * @returns A locally formatted date string
 */
export function formatDate(
    dateStr: string | Date | undefined,
    options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
    return formatFhirDate(dateStr, options);
}
