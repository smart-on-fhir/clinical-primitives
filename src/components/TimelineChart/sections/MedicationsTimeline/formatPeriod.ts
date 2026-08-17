/**
 * Formatting for a medication's start and end, shared by the hover tooltip and
 * the sidebar detail view so the two can never disagree about a course's dates.
 */

const DAY = 86_400_000;

/**
 * Whether a timestamp carries a real time of day.
 *
 * FHIR `date` values ("2020-03-04") parse to exactly UTC midnight, while
 * `dateTime` values almost never land there. That makes an exact UTC midnight a
 * reliable-enough marker for "this resource recorded a day, not a moment" —
 * which matters, because printing "12:00 AM" for a date-only value invents
 * precision the source never had.
 *
 * A dateTime that genuinely falls on UTC midnight is read as date-only. The
 * only cost is a suppressed "12:00 AM", so the failure is harmless.
 */
function hasTimeOfDay(time: number): boolean {
    return time % DAY !== 0;
}

/**
 * Date-only values are formatted in UTC deliberately. They denote a calendar
 * day with no zone, and rendering that UTC midnight in local time shows the
 * previous day for anyone west of UTC.
 */
function formatDay(time: number): string {
    return hasTimeOfDay(time)
        ? new Date(time).toLocaleDateString()
        : new Date(time).toLocaleDateString(undefined, { timeZone: "UTC" });
}

function formatTimeOfDay(time: number): string {
    return new Date(time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export interface FormattedPeriod {
    /** Start, as a date — plus its time when the course begins and ends on one day. */
    start: string,

    /** End in the same shape as {@link start}, or null when none was recorded. */
    end: string | null,

    /**
     * The end without its date, for places already showing the start alongside
     * it. Falls back to the full {@link end} when the dates differ.
     */
    endCompact: string | null,

    /** Whether start and end fall on the same calendar day. */
    sameDay: boolean
}

/**
 * Format a course's dates, widening to include clock times when it starts and
 * ends on the same day.
 *
 * A same-day course is the case a plain date cannot express: "3/4/2020 –
 * 3/4/2020" reads as a formatting fault, and a single "3/4/2020" hides that the
 * medication ran for four hours. The times are only shown when they exist and
 * differ, so a date-only resource is never dressed up as a precise one.
 */
export function formatMedicationPeriod(period: { start: number, end?: number }): FormattedPeriod {
    const { start, end } = period;

    if (end === undefined) {
        return { start: formatDay(start), end: null, endCompact: null, sameDay: false };
    }

    const sameDay = formatDay(start) === formatDay(end);

    // Two distinct instants within one day are only distinguishable by their
    // times, so their presence is evidence the times are real. Identical
    // timestamps carry no such evidence — that is an instant, not a span.
    const showTimes = sameDay && start !== end && hasTimeOfDay(start) && hasTimeOfDay(end);

    if (!showTimes) {
        return {
            start     : formatDay(start),
            end       : formatDay(end),
            endCompact: formatDay(end),
            sameDay
        };
    }

    return {
        start     : `${formatDay(start)}, ${formatTimeOfDay(start)}`,
        end       : `${formatDay(end)}, ${formatTimeOfDay(end)}`,
        endCompact: formatTimeOfDay(end),
        sameDay   : true
    };
}
