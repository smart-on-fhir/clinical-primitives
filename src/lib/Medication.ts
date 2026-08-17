import {
    Dosage,
    Medication,
    MedicationAdministration,
    MedicationRequest,
    MedicationStatement,
    Quantity,
    Range,
    Ratio,
    Timing
} from "fhir/r4";

/**
 * Extracts the generic drug name from a raw FHIR medication string.
 * Collects words up to the first dose/form token (digit-prefixed or known unit/form word).
 * Strips the FDA biosimilar 4-letter suffix (e.g. adalimumab-adaz → Adalimumab).
 */
export function normalizeMedName(raw: string): string {
    const STOP_WORDS = new Set([
        'MG', 'MCG', 'UG', 'G', 'ML', 'L', 'MEQ', 'UNIT', 'UNITS', 'IU', 'MMol',
        'ORAL', 'TABLET', 'TABLETS', 'TAB', 'TABS', 'CAPSULE', 'CAPSULES', 'CAP', 'CAPS',
        'SOLUTION', 'SUSPENSION', 'INJECTABLE', 'INJECTION', 'INFUSION',
        'PREFILLED', 'SYRINGE', 'PEN', 'AUTO-INJECTOR',
        'PATCH', 'CREAM', 'GEL', 'OINTMENT', 'FOAM', 'SUPPOSITORY', 'ENEMA', 'DROPS',
        'EXTENDED', 'IMMEDIATE', 'MODIFIED', 'DELAYED', 'RELEASE',
    ]);

    // Tokens that may appear before the drug name (e.g. "24 HR Metformin...")
    const PREFIX_SKIP = new Set(['HR', 'H', 'MIN', 'SEC']);

    // A bracketed aside is a gloss on the name, not more of the name.
    //
    // Records routinely restate the drug in brackets — "ferrous sulfate (ferrous
    // sulfate)" from Epic, "Humira (adalimumab)" or "Humira [adalimumab]"
    // wherever a brand is being tied to its generic. Both bracket styles are in
    // the wild for the same purpose, so both are dropped. Treating them as mere
    // separators, which is what splitting on them did, ran the two names
    // together: "Ferrous Sulfate Ferrous Sulfate". Dropping the gloss keeps
    // whichever name the record chose to lead with, and the full product name is
    // still a `getMedicationName` away for anywhere the difference matters.
    //
    // An unclosed bracket takes the rest of the string with it — a name truncated
    // mid-gloss is more likely to be cut off than to be meaningful.
    const glossed  = raw.replace(/\s*(\([^)]*(\)|$)|\[[^\]]*(\]|$))/g, " ");

    // Except where that leaves nothing: a wholly parenthesized name is still a
    // name, and the brackets are then just punctuation around it.
    const withName = glossed.trim() ? glossed : raw;

    const tokens = withName.trim().split(/[\s,/()[\]]+/).filter(Boolean);
    const nameTokens: string[] = [];
    let nameStarted = false;

    for (const t of tokens) {
        const up = t.toUpperCase();
        // Skip leading numeric/time-unit tokens before the drug name begins
        if (!nameStarted && (/^\d/.test(t) || PREFIX_SKIP.has(up))) continue;
        nameStarted = true;
        if (/^\d/.test(t) || STOP_WORDS.has(up)) break;
        // Strip FDA biosimilar suffix: exactly 4 lowercase letters after a hyphen
        const stripped = t.replace(/-[a-z]{4}$/i, '');
        nameTokens.push(stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase());
    }

    return nameTokens.join(' ') || raw;
}

export function getMedicationName(med: MedicationRequest | MedicationAdministration | Medication | MedicationStatement): string | null {
    if (med.resourceType === 'Medication') {
        return med.code?.text
            || med.code?.coding?.[0]?.display
            || med.code?.coding?.[0]?.code
            || null;
    }
    const req = med as MedicationRequest | MedicationAdministration | MedicationStatement;
    return req.medicationCodeableConcept?.text
        || req.medicationCodeableConcept?.coding?.[0]?.display
        || req.medicationCodeableConcept?.coding?.[0]?.code
        || req.medicationReference?.display
        || null;
}

/**
 * The drug name alone, with dose, form and packaging stripped — "Metformin
 * Hydrochloride" rather than "24 HR Metformin hydrochloride 500 MG Extended
 * Release Oral Tablet".
 *
 * For display where space is tight, such as timeline row labels. Keep
 * {@link getMedicationName} for anywhere the full prescribed product matters —
 * the strength and form are clinically meaningful and are discarded here.
 */
export function getShortMedicationName(
    med: MedicationRequest | MedicationAdministration | Medication | MedicationStatement
): string | null {
    const full = getMedicationName(med);
    return full === null ? null : normalizeMedName(full);
}

export function getActiveMedications(medications: MedicationRequest[]): MedicationRequest[] {
    return medications.filter(med => {
        return (med.status?.toLowerCase() ?? '') === 'active';
    });
}

/** Milliseconds since the epoch for a FHIR dateTime, or null if absent or unparseable. */
function toTime(value?: string): number | null {
    if (!value) {
        return null;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

/**
 * When a medication was taken, as a start and an optional end.
 *
 * `end` being undefined means the end is genuinely unknown — either the course
 * is still running or the resource never recorded one. Callers decide how to
 * present that; this function does not invent a date.
 *
 * PROVISIONAL: the order of preference below is a first pass and has not been
 * validated against real-world data beyond the Synthea sample bundle, where no
 * medication carries a period at all.
 */
export function getMedicationPeriod(
    med: MedicationRequest | MedicationAdministration | MedicationStatement
): { start: number, end?: number } | null {

    const periods = [
        // Most specific: an explicitly bounded course of treatment.
        ...(("dosageInstruction" in med ? med.dosageInstruction : undefined) ?? [])
            .map(d => d.timing?.repeat?.boundsPeriod),
        ("dispenseRequest" in med ? med.dispenseRequest?.validityPeriod : undefined),
        ("effectivePeriod" in med ? med.effectivePeriod : undefined)
    ];

    for (const period of periods) {
        const start = toTime(period?.start);
        if (start !== null) {
            return { start, end: toTime(period?.end) ?? undefined };
        }
    }

    // Fall back to a single point in time: when it was prescribed, administered
    // or reported. Such a medication has no duration we can honestly draw.
    const instant =
        toTime("authoredOn" in med ? med.authoredOn : undefined) ??
        toTime("effectiveDateTime" in med ? med.effectiveDateTime : undefined) ??
        toTime("dateAsserted" in med ? med.dateAsserted : undefined);

    return instant === null ? null : { start: instant };
}

/** Singular and plural names for the UCUM time codes FHIR uses in `Timing.repeat`. */
const PERIOD_UNITS: Record<string, [string, string]> = {
    s  : ["second", "seconds"],
    min: ["minute", "minutes"],
    h  : ["hour"  , "hours"  ],
    d  : ["day"   , "days"   ],
    wk : ["week"  , "weeks"  ],
    mo : ["month" , "months" ],
    a  : ["year"  , "years"  ]
};

/** The FHIR days-of-week codes, spelled out. */
const DAYS_OF_WEEK: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday"
};

/** Abbreviations from the HL7 event-timing value set, spelled out. */
const EVENT_TIMING: Record<string, string> = {
    MORN     : "in the morning",
    AFT      : "in the afternoon",
    EVE      : "in the evening",
    NIGHT    : "at night",
    NOON     : "at noon",
    PHS      : "after a meal",
    HS       : "at bedtime",
    WAKE     : "on waking",
    AC       : "before meals",
    ACM      : "before breakfast",
    ACD      : "before lunch",
    ACV      : "before dinner",
    PC       : "after meals",
    PCM      : "after breakfast",
    PCD      : "after lunch",
    PCV      : "after dinner"
};

/** The display text of a CodeableConcept, preferring `text` over the first coding. */
function conceptText(concept?: { text?: string, coding?: { display?: string, code?: string }[] }): string | undefined {
    return concept?.text || concept?.coding?.[0]?.display || concept?.coding?.[0]?.code || undefined;
}

/** "500 mg". Unit first, falling back to the UCUM code when there is no display unit. */
function quantityText(quantity?: Quantity): string | undefined {
    if (!quantity || quantity.value === undefined) {
        return undefined;
    }
    const unit = quantity.unit || quantity.code;
    return unit ? `${quantity.value} ${unit}` : String(quantity.value);
}

/** "250 mg - 500 mg", or just one end when only one is recorded. */
function rangeText(range?: Range): string | undefined {
    const low  = quantityText(range?.low);
    const high = quantityText(range?.high);
    return low && high ? `${low} - ${high}` : low || high;
}

/** "100 mL / 1 hour". A denominator of 1 keeps its unit so the rate still reads as a rate. */
function ratioText(ratio?: Ratio): string | undefined {
    const numerator   = quantityText(ratio?.numerator);
    const denominator = quantityText(ratio?.denominator);
    if (!numerator) {
        return undefined;
    }
    return denominator ? `${numerator} / ${denominator}` : numerator;
}

/** A clock time, with or without separators: "0800", "08:00", "08:00:00". */
const CLOCK_TIME = /^([01]?\d|2[0-3]):?([0-5]\d)(?::[0-5]\d)?$/;

/**
 * The administration times in a string, if that is all the string holds.
 *
 * `timing.code` is meant for a coded schedule, but systems routinely put their
 * own frequency-table entry there instead, and Epic's is often just the times a
 * dose is due — "0800, 2000". Read as a frequency that is meaningless; read as
 * times it is useful, so it is worth recognizing. Returns null for anything
 * that is not exclusively clock times, which leaves genuine codes like "BID"
 * alone.
 */
function parseTimeList(text?: string): string[] | null {
    if (!text) {
        return null;
    }

    const tokens = text.split(/[,;]+/).map(token => token.trim()).filter(Boolean);

    return tokens.length && tokens.every(token => CLOCK_TIME.test(token)) ? tokens : null;
}

/**
 * A FHIR `time` as a locale clock time: "08:00:00" becomes "8:00 AM".
 *
 * Systems that do not send a conformant `time` are left alone rather than
 * mangled — a bare "0800" is at least readable as it stands.
 */
function timeOfDayText(value: string): string {
    const match = /^(\d{2}):?(\d{2})/.exec(value);

    if (!match) {
        return value;
    }

    const hours   = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) {
        return value;
    }

    // Any date will do — only the clock fields are formatted.
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
        .format(new Date(2000, 0, 1, hours, minutes));
}

/**
 * How often a medication is taken, as prose: "twice daily", "every 8 hours",
 * "3 times every 2 weeks".
 *
 * Only the structured `repeat` fields are read. A `Timing` that carries its
 * meaning in `code` alone (BID, TID) is handled by the caller, which falls back
 * to that code's display text when there is nothing to reconstruct from here.
 */
function repeatText(repeat?: Timing["repeat"]): string | undefined {
    if (!repeat) {
        return undefined;
    }

    const parts: string[] = [];

    const { frequency, frequencyMax, period, periodUnit } = repeat;
    const unit = periodUnit ? PERIOD_UNITS[periodUnit] : undefined;

    if (unit && period !== undefined) {
        // "once a day" reads worse than "once daily", and daily dosing is by far
        // the most common case, so it gets the idiomatic phrasing.
        const perPeriod = period === 1 && periodUnit === "d" ?
            "daily" :
            `every ${period === 1 ? unit[0] : `${period} ${unit[1]}`}`;

        const times = frequency ?? 1;
        const count = frequencyMax && frequencyMax !== times ?
            `${times} to ${frequencyMax} times` :
            times === 1 ? "once" : times === 2 ? "twice" : `${times} times`;

        // "every 8 hours" already says once, so the count is dropped there;
        // "daily" does not, so it keeps it.
        parts.push(
            perPeriod === "daily"      ? `${count} daily` :
            count      === "once"      ? perPeriod :
            `${count} ${perPeriod}`
        );
    }

    // An infusion states how long each administration runs rather than how often
    // it repeats, so this stands alone as well as alongside a frequency.
    if (repeat.duration !== undefined && repeat.durationUnit) {
        const durationUnit = PERIOD_UNITS[repeat.durationUnit];
        if (durationUnit) {
            parts.push(`over ${repeat.duration} ${repeat.duration === 1 ? durationUnit[0] : durationUnit[1]}`);
        }
    }

    if (repeat.dayOfWeek?.length) {
        parts.push(`on ${repeat.dayOfWeek.map(day => DAYS_OF_WEEK[day] ?? day).join(", ")}`);
    }

    // `timeOfDay` deliberately not included: clock times are not a frequency,
    // and are reported separately as `times`.

    if (repeat.when?.length) {
        parts.push(repeat.when.map(code => EVENT_TIMING[code] ?? code).join(", "));
    }

    return parts.length ? parts.join(" ") : undefined;
}

/**
 * A single dosing instruction reduced to display strings. Every field is
 * optional because real resources fill in wildly different subsets — some carry
 * nothing but a free-text `sig`, others nothing but a coded dose.
 */
export interface MedicationDosage {
    /** The prescriber's own free-text instruction (the "sig"), verbatim. */
    text?: string,

    /** Amount per administration: "500 mg", or a range. */
    dose?: string,

    /** Speed of administration, for infusions: "100 mL / 1 hour". */
    rate?: string,

    /** How often, as prose: "twice daily". */
    frequency?: string,

    /**
     * The clock times a dose is due: "8:00 AM, 8:00 PM". Separate from
     * {@link frequency} because a list of times is not a frequency — it says
     * when within a day, never how many days.
     */
    times?: string,

    /** Route of administration: "Oral", "Intravenous". */
    route?: string,

    /** Method: "Slow Push", "Inhale". */
    method?: string,

    /** Body site. */
    site?: string,

    /** Set when the medication is taken only as needed, with the reason if coded. */
    asNeeded?: string,

    /** Which instruction this is, when a request carries several in sequence. */
    sequence?: number
}

/** Everything but `sequence` absent — nothing worth showing. */
function isEmptyDosage(dosage: MedicationDosage): boolean {
    return !dosage.text && !dosage.dose && !dosage.rate && !dosage.frequency &&
           !dosage.times && !dosage.route && !dosage.method && !dosage.site &&
           !dosage.asNeeded;
}

/** Reads a `Dosage`, as carried by MedicationRequest and MedicationStatement. */
function fromDosage(dosage: Dosage): MedicationDosage {
    // `doseAndRate` allows several entries for a tapering schedule; only the
    // first is read here. A taper needs its own presentation, not a squashed one.
    const doseAndRate = dosage.doseAndRate?.[0];

    const asNeededReason = conceptText(dosage.asNeededCodeableConcept);

    // A `timing.code` that turns out to be a list of times is reported as times
    // and must not then also be offered as the frequency.
    const codeText  = conceptText(dosage.timing?.code);
    const codeTimes = parseTimeList(codeText);

    const times = dosage.timing?.repeat?.timeOfDay?.length ?
        dosage.timing.repeat.timeOfDay :
        codeTimes;

    return {
        text     : dosage.text || undefined,
        dose     : quantityText(doseAndRate?.doseQuantity) ?? rangeText(doseAndRate?.doseRange),
        rate     : ratioText(doseAndRate?.rateRatio) ??
                   quantityText(doseAndRate?.rateQuantity) ??
                   rangeText(doseAndRate?.rateRange),

        // The structured fields come first. `timing.code` is nominally a coded
        // schedule (BID, TID) with a human display, but in practice systems put
        // their own frequency-table entry there — a bare list of administration
        // times, say — which is worse than the prose we can build ourselves. It
        // is only reached when `repeat` yields nothing.
        frequency: repeatText(dosage.timing?.repeat) ?? (codeTimes ? undefined : codeText),
        times    : times?.map(timeOfDayText).join(", "),

        route    : conceptText(dosage.route),
        method   : conceptText(dosage.method),
        site     : conceptText(dosage.site),
        asNeeded : asNeededReason ? `as needed for ${asNeededReason}` :
                   dosage.asNeededBoolean ? "as needed" : undefined,
        sequence : dosage.sequence
    };
}

/**
 * How a medication is to be, or was, taken — dose, rate, frequency and route,
 * as strings ready to display.
 *
 * A MedicationRequest may carry several instructions in sequence (a taper, or a
 * loading dose followed by maintenance), so this returns an array; the common
 * case is one entry. Instructions that would render empty are dropped, so an
 * empty array means the resource records no usable dosing information.
 *
 * MedicationAdministration is shaped differently — one dose actually given
 * rather than a plan — and is normalized into the same form. It has no
 * frequency: a single administration does not repeat.
 */
export function getMedicationDosages(
    med: MedicationRequest | MedicationAdministration | MedicationStatement
): MedicationDosage[] {

    if (med.resourceType === "MedicationAdministration") {
        const dosage = med.dosage;

        if (!dosage) {
            return [];
        }

        const result: MedicationDosage = {
            text  : dosage.text || undefined,
            dose  : quantityText(dosage.dose),
            rate  : ratioText(dosage.rateRatio) ?? quantityText(dosage.rateQuantity),
            route : conceptText(dosage.route),
            method: conceptText(dosage.method),
            site  : conceptText(dosage.site)
        };

        return isEmptyDosage(result) ? [] : [result];
    }

    // The same Dosage type, under two different names: MedicationRequest plans
    // instructions, MedicationStatement reports what was taken.
    const instructions = med.resourceType === "MedicationStatement" ?
        med.dosage :
        med.dosageInstruction;

    return (instructions ?? [])
        .map(fromDosage)
        .filter(dosage => !isEmptyDosage(dosage));
}


