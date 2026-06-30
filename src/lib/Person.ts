import { Address, HumanName, Patient, Practitioner, RelatedPerson } from "fhir/r4";
import { capitalize } from "../utils";

export function displayName(name: HumanName): string {
    const parts = [];
    if (name.prefix) parts.push(name.prefix.join(' ').trim());
    if (name.given ) parts.push(name.given.join(' ').trim());
    if (name.family) parts.push(name.family.trim());
    if (name.suffix) parts.push(name.suffix.join(' ').trim());
    return parts.filter(Boolean).join(' ');
}

export function displayPersonName(person: Patient | Practitioner | RelatedPerson, use?: HumanName['use']): string | null {
    if (!Array.isArray(person.name) || person.name.length === 0) return null;

    if (use) {
        const name = person.name.find(n => n.use === use);
        if (name) {
            return displayName(name);
        }
        return null;
    }

    let name = person.name.find(n => n.use === 'official') ||
               person.name.find(n => n.use === 'usual')    ||
               person.name[0];
    
    return displayName(name);
}

export function displayAddress(address: Address): string {
    const parts = [];
    if (address.line      ) parts.push(address.line.join(', ').trim());
    if (address.city      ) parts.push(address.city.trim());
    if (address.state     ) parts.push(address.state.trim());
    if (address.postalCode) parts.push(address.postalCode.trim());
    if (address.country   ) parts.push(address.country.trim());
    return parts.filter(Boolean).join(', ');
}

export function displayPersonAddress(person: Patient | Practitioner | RelatedPerson, use?: Address['use']): string | null {
    if (!Array.isArray(person.address) || person.address.length === 0) return null;

    if (use) {
        const address = person.address.find(a => a.use === use);
        if (address) {
            return displayAddress(address);
        }
        return null;
    }

    let address = person.address.find(a => a.use === 'home') ||
                  person.address.find(a => a.use === 'work') ||
                  person.address[0];
    
    return displayAddress(address);
}

export function displayPersonGender(person: Patient | Practitioner | RelatedPerson): string | null {
    if (!person.gender) return null;
    return capitalize(person.gender);
}
