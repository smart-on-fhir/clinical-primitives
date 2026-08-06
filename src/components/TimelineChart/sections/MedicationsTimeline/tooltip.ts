import { escapeTooltipMarkdown } from "../../../Tooltip";
import { ONGOING_STATUSES, type TimelineMedication } from "./classify";
import { formatMedicationPeriod } from "./formatPeriod";
import {
    getMedicationDosages,
    getMedicationName,
    getMedicationPeriod,
    getShortMedicationName
} from "../../../../lib/Medication";

/**
 * Summarizes a medication for the tooltip shown while its bar is hovered.
 *
 * Answers "what is this bar", not "tell me everything" — the sidebar detail
 * view already does the latter, and a hover that reproduced it would cover the
 * chart it is explaining. So: what the drug is, whether it is still running,
 * when it ran, and the first dosing step.
 *
 * Every interpolated value is escaped. Product names and free-text sigs contain
 * Markdown markers routinely ("Vitamin B_12", "take 1-2 tablets *as needed*"),
 * and an unescaped one would eat the rest of the line.
 */
export function medicationTooltip(med: TimelineMedication): string {
    const short  = getShortMedicationName(med);
    const full   = getMedicationName(med);
    const period = getMedicationPeriod(med);
    const status = med.status ?? "unknown";

    const lines: string[] = [];

    // The full product name carries strength and form, which are clinically
    // meaningful; the short name is the fallback, not the preference.
    lines.push(`**${escapeTooltipMarkdown(full ?? short ?? "Unnamed medication")}**`);

    // Dates describe the resource, not the bar. A bar with no recorded end is
    // drawn as reaching "now" when the status says the course is running, but
    // that is an inference — saying "ongoing" keeps it from reading as a
    // recorded end date, and an unrecorded end says so plainly.
    if (period) {
        const formatted = formatMedicationPeriod(period);

        // Null means there is no second value worth printing: either the course
        // is a single instant, or its end was never recorded and the status
        // gives no grounds to call it ongoing. Rendering those as
        // "3/4/2020 – 3/4/2020" would imply a measured duration.
        //
        // The compact end drops the date when both fall on one day, so a
        // same-day course reads "3/4/2020, 8:00 AM – 12:00 PM" rather than
        // repeating the date in a bubble that has no room for it.
        const end =
            period.end && period.end !== period.start ? formatted.endCompact :
            !period.end && ONGOING_STATUSES.has(status) ? "ongoing" :
            null;

        lines.push(end
            ? `${escapeTooltipMarkdown(status)} · ${formatted.start} – ${end}`
            : `${escapeTooltipMarkdown(status)} · ${formatted.start}`);
    }
    else {
        lines.push(escapeTooltipMarkdown(status));
    }

    const dosages = getMedicationDosages(med);
    const dosage  = dosages[0];

    if (dosage) {
        const facts = [
            dosage.dose      && `Dose: ${dosage.dose}`,
            dosage.rate      && `Rate: ${dosage.rate}`,
            [dosage.frequency, dosage.asNeeded].filter(Boolean).join(", ") || null,
            dosage.route     && `Route: ${dosage.route}`
        ].filter((fact): fact is string => Boolean(fact));

        if (facts.length) {
            lines.push("", ...facts.map(fact => `- ${escapeTooltipMarkdown(fact)}`));
        }

        // A multi-step regimen is a taper or a loading dose. Showing only the
        // first step without saying so would misrepresent the prescription.
        if (dosages.length > 1) {
            lines.push("", `*+ ${dosages.length - 1} more dosing step${dosages.length === 2 ? "" : "s"}*`);
        }
        else if (!facts.length && dosage.text) {
            // No structured dosing, but the prescriber wrote something.
            lines.push("", escapeTooltipMarkdown(dosage.text));
        }
    }

    return lines.join("\n");
}
