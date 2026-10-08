export * as Person     from "./Person";
export * as Patient    from "./Patient";
export * as Identifier from "./Identifier";
export * as Medication from "./Medication";

/**
 * A FHIR date or dateTime as display text. Same function as `formatDate` in
 * `components/Date/utils.ts`: date-only values are shown in UTC, at their own
 * precision, so they don't read a day early west of UTC.
 */
export { formatFhirDate as formatDate } from "../components/Date/utils";
