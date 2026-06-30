import { Identifier } from "fhir/r4";

interface IdentifierFilters {
    system?: string
    value?: string
    use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old'
    periodStart?: string
    periodEnd?: string
}

export function format(identifier: Identifier): string {
    if (identifier.value) {
        if (identifier.system) {
            return `${identifier.system}|${identifier.value}`;
        }
        return identifier.value;
    }
    return '';
}

export function matches(identifier: Identifier, filters: IdentifierFilters): boolean {
    if (filters.system && identifier.system !== filters.system)
        return false;

    if (filters.value && identifier.value !== filters.value)
        return false;

    if (filters.use && identifier.use !== filters.use)
        return false;

    if (filters.periodStart) {
        if (!identifier.period || !identifier.period.start || new Date(identifier.period.start) < new Date(filters.periodStart))
            return false;
    }

    if (filters.periodEnd) {
        if (!identifier.period || !identifier.period.end || new Date(identifier.period.end) > new Date(filters.periodEnd))
            return false;
    }

    return true;
}

export function findAll(identifiers: Identifier[], filters: IdentifierFilters): Identifier[] {
    return identifiers.filter(id => matches(id, filters));
}

export function find(identifiers: Identifier[], filters: IdentifierFilters): Identifier | undefined {
    return identifiers.find(id => matches(id, filters));
}
