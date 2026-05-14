import { Immunization } from "fhir/r4";

export function getName(i: Immunization): string {
    return i.vaccineCode?.text
        || i.vaccineCode?.coding?.[0]?.display
        || i.vaccineCode?.coding?.[0]?.code
        || 'Unknown vaccine';
}

export function getOccurrence(i: Immunization): string | null {
    return i.occurrenceDateTime ?? null;
}

export function getStatusReason(i: Immunization): string | null {
    return i.statusReason?.text
        || i.statusReason?.coding?.[0]?.display
        || null;
}

export function getRoute(i: Immunization): string | null {
    return i.route?.text
        || i.route?.coding?.[0]?.display
        || null;
}