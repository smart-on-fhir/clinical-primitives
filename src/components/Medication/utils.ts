import { Medication, MedicationAdministration, MedicationRequest } from "fhir/r4";

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

    const tokens = raw.trim().split(/[\s,/()[\]]+/).filter(Boolean);
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

export function getMedicationName(med: MedicationRequest | MedicationAdministration | Medication): string | null {
    if (med.resourceType === 'Medication') {
        return med.code?.text
            || med.code?.coding?.[0]?.display
            || med.code?.coding?.[0]?.code
            || null;
    }
    const req = med as MedicationRequest | MedicationAdministration;
    return req.medicationCodeableConcept?.text
        || req.medicationCodeableConcept?.coding?.[0]?.display
        || req.medicationCodeableConcept?.coding?.[0]?.code
        || req.medicationReference?.display
        || null;
}
