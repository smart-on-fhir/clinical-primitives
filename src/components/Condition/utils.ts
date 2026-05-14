import { Condition } from "fhir/r4";

export function getName(c: Condition): string {
    return c.code?.text
        || c.code?.coding?.[0]?.display
        || c.code?.coding?.[0]?.code
        || 'Unknown condition';
}

export function getClinicalStatus(c: Condition): string | null {
    return c.clinicalStatus?.coding?.[0]?.code
        || c.clinicalStatus?.text
        || null;
}

export function getVerificationStatus(c: Condition): string | null {
    return c.verificationStatus?.coding?.[0]?.code
        || c.verificationStatus?.text
        || null;
}

export function getBodySite(c: Condition): string | null {
    return c.bodySite?.[0]?.text
        || c.bodySite?.[0]?.coding?.[0]?.display
        || null;
}

export function getOnset(c: Condition): string | null {
    if (c.onsetDateTime) return c.onsetDateTime;
    if (c.onsetPeriod?.start) return c.onsetPeriod.start;
    return null;
}

export function getAbatement(c: Condition): string | null {
    if (c.abatementDateTime) return c.abatementDateTime;
    if (c.abatementPeriod?.start) return c.abatementPeriod.start;
    return null;
}