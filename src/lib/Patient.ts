import { Patient } from "fhir/r4";
import { parseFhirDateLocal } from "../components/Date/utils";

export function calcAge(patient: Patient): { age: number | null, unit: 'years' | 'months' | 'days' | null } {
    const out = { age: null, unit: null };

    // No DOB, can't calculate age
    if (!patient.birthDate) return out

    // Patient dies but we don't know when, can't calculate age at death
    if (patient.deceasedBoolean === true) return out
  
    // Calculate age at death if we have a date of death, otherwise calculate current age
    // Local calendar dates, so a birthDate isn't read as the day before it west
    // of UTC (which would add the year a day early).
    const from = parseFhirDateLocal(patient.birthDate)
    const to   = patient.deceasedDateTime ? parseFhirDateLocal(patient.deceasedDateTime) : new Date()
    if (!from || !to) return out

    // Calculate age in years
    let age = to.getFullYear() - from.getFullYear()
    const m = to.getMonth() - from.getMonth()
    if (m < 0 || (m === 0 && to.getDate() < from.getDate())) age--
    if (age > 0)
        return { age, unit: 'years' }
  
    // If less than a year old, calculate in months
    age = m >= 0 ? m : m + 12
    if (age > 0)
        return { age, unit: 'months' }
  
    // If less than a month old, calculate in days
    const diffTime = Math.abs(to.getTime() - from.getTime())
    age = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return { age, unit: 'days' }
}

export function displayPatientAge(patient: Patient, units?: { years?: string, months?: string, days?: string } | false): string | null {
    const { age, unit } = calcAge(patient)
    if (age === null || unit === null) return null
    if (units === false) {
        return `${age}`;
    }
    const unitStr = units?.[unit] || unit[0] + '/o'
    return `${age} ${unitStr}`
}
