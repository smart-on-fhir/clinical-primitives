import type { ReactNode } from "react";
import type { MedicationAdministration, MedicationRequest } from "fhir/r4";
import { getShortMedicationName } from "../../../../lib/Medication";

export type TimelineMedication = MedicationRequest | MedicationAdministration;

/**
 * What a section should do with one medication. Every field is optional — a
 * classifier only has to state what it wants changed, and the section fills in
 * the rest.
 */
export type MedicationClassification = {
    /** Display name for the row. Defaults to the short medication name. */
    name?: string,

    /**
     * Which row this medication joins. Defaults to `name`, so medications
     * sharing a name share a row. Set it to group by something else — a drug
     * class, or an RxNorm code that distinguishes products a name would merge.
     */
    group?: string,

    /** Row label, when a plain string is not enough. Defaults to `name`. */
    label?: ReactNode,

    /** Bar fill, as any CSS color — from a drug class, say. */
    color?: string,

    /**
     * Extra classes on this medication's bars, for decoration a color cannot
     * express: a hatched fill for PRN dosing, an opacity modifier for a low
     * dose, a border for a route.
     */
    className?: string,

    /** Row sort position. Rows without one sort after those with, by start date. */
    order?: number,

    /**
     * The legend entry this medication belongs to — a drug class, typically.
     *
     * The section collects the distinct categories it actually rendered and
     * hands them to a `legend` render function, so a color key can list only
     * what is on screen and cannot name a class that isn't there.
     */
    category?: { key: string, label: string }
};

/** A category that made it onto the chart, paired with the color it was drawn in. */
export type MedicationLegendEntry = {
    key: string,
    label: string,
    color?: string
};

/**
 * Decides what a section does with a medication, or returns null to leave it
 * out entirely.
 *
 * The section runs {@link classifyMedication} first and hands the result in as
 * `base`, so the common case — keep the default's decisions, change one field —
 * needs no import and cannot drift from what the default means by "active":
 *
 * ```ts
 * classify={(base, med) => base && { ...base, color: colorForClass(med) }}
 * ```
 *
 * `base` is null when the default would have dropped the medication. The
 * classifier is still called, so it can override that and include it anyway;
 * returning null drops it whatever the default said. Ignoring `base` and
 * returning a fresh classification replaces the default outright.
 *
 * `options` carries the section's own user-facing settings, so a custom
 * classifier can honor them rather than having to re-create the controls.
 */
export type MedicationClassifier = (
    base: MedicationClassification | null,
    med: TimelineMedication,
    options: { includeInactive: boolean }
) => MedicationClassification | null;

/**
 * Statuses counted as active. `in-progress` is here so MedicationAdministration
 * is judged on equal terms with MedicationRequest's `active`. `on-hold` is
 * deliberately excluded — a paused medication is not one the patient is on.
 *
 * Exported so the section can draw non-active courses back without re-deciding
 * what "active" means. A classifier that answered that question differently
 * from the filter hiding them would dim the wrong bars.
 */
export const ACTIVE_STATUSES = new Set(["active", "in-progress"]);

/**
 * Statuses that mean the medication is still running, so a course with no end
 * date is drawn as reaching "now". Wider than {@link ACTIVE_STATUSES}: a
 * paused medication is not one the patient is on, but its course has not ended
 * either, so its bar should not stop at its start date.
 */
export const ONGOING_STATUSES = new Set(["active", "on-hold", "in-progress"]);

/**
 * The default classification, applied to every medication before a custom
 * {@link MedicationClassifier} sees it: keep active medications, name them by
 * their short name, and leave color to the section's default palette.
 *
 * A classifier receives the result as its `base` argument, so this rarely needs
 * calling directly. It stays exported for the case where one is rebuilt under
 * different terms — classifying a medication the section is not currently
 * showing, say.
 */
export const classifyMedication = (
    med: TimelineMedication,
    { includeInactive }: { includeInactive: boolean }
): MedicationClassification | null => {
    if (!includeInactive && !ACTIVE_STATUSES.has(med.status ?? "")) {
        return null;
    }

    return { name: getShortMedicationName(med) ?? "Unnamed medication" };
};
