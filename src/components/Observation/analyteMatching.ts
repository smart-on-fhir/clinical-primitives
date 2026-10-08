import type { Observation } from "fhir/r4";

/**
 * Which readings belong to which analyte: the one rule behind every view that
 * sorts observations into named rows (`LabTrendPanel`, `ObservationsTimeline`).
 *
 * Kept in one place because the two used to disagree. A substring keyword test
 * that ran regardless of a reading's code put Hemoglobin A1c in Hemoglobin,
 * urine microalbumin in Albumin and lymphocyte percentages in a count row —
 * every one of them a reading that had already said, in LOINC, what it was.
 */

/** What matching needs to know about an analyte. */
export interface AnalyteSpec {
    /** Codes that claim a reading outright, in any coding system. */
    codes: readonly string[];

    /**
     * Words to match against a reading's own display text when no analyte
     * claims it by code — see {@link keywordHit} and {@link assignReadings} for
     * when they are consulted at all.
     */
    keywords?: readonly string[];
}

/** Whether one of the analyte's codes appears among the reading's codings. */
export function codeHit(analyte: AnalyteSpec, obs: Observation): boolean {
    const codes = new Set(analyte.codes);

    return (obs.code?.coding ?? []).some(coding =>
        coding.code !== undefined && codes.has(coding.code));
}

/** Every name the record gives a reading, lowercased into one string. */
function readingText(obs: Observation): string {
    return [obs.code?.text, ...(obs.code?.coding ?? []).map(coding => coding.display)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

/**
 * The longest of the analyte's keywords that the reading's own text contains,
 * as a length — zero for none.
 *
 * A length rather than a boolean because two analytes can both match by keyword
 * and only one can have the reading. Length stands in for specificity, which is
 * crude but right in the cases that occur: "prealbumin" beats "albumin" for a
 * result named Prealbumin, and that is exactly the pair that goes wrong.
 *
 * Matched on word boundaries rather than as bare substrings. Without that, `mch`
 * claims MCHC, `alt` claims anything with "elastase" or "cobalt" in its name,
 * and `ast` claims gastrin — abbreviations are short enough that free substring
 * matching finds them everywhere.
 */
export function keywordHit(analyte: AnalyteSpec, obs: Observation): number {
    const keywords = analyte.keywords ?? [];
    if (keywords.length === 0) return 0;

    const text = readingText(obs);

    let best = 0;

    for (const keyword of keywords) {
        const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Bounded by anything that is not alphanumeric, so a keyword can sit at
        // either end of the text and can itself contain spaces or hyphens —
        // "c reactive protein", "pre-albumin", "25-oh" all behave.
        if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text)) {
            best = Math.max(best, keyword.length);
        }
    }

    return best;
}

/**
 * Which analyte each reading belongs to, decided across the whole list at once,
 * as an index into `analytes`. A reading no analyte wants is absent from the map.
 *
 * Necessary because "does this analyte match" is the wrong question. Laboratory
 * names nest: LOINC calls MCV "MCV [Entitic mean volume] in **Red Blood
 * Cells**", MCHC "MCHC … in **Red Blood Cells**", RDW "**Erythrocyte**
 * distribution width", ESR "**Erythrocyte** [Sedimentation Rate]". An RBC row
 * with the obvious keywords claims all four, and asked one analyte at a time
 * there is no way to notice, because each of them is also right on its own
 * terms. The result is a row labeled RBC plotting distribution widths, on a
 * scale inferred from whichever of them happened to be commonest.
 *
 * So ownership is exclusive and decided in three steps:
 *
 * 1. **A code beats a name.** A reading coded 787-2 is MCV's, whatever its
 *    display text says, because a code is an assertion by whoever wrote the
 *    record and a keyword is a guess by whoever wrote the panel. Where two
 *    analytes claim the same code, the earlier one in the list has it.
 * 2. **A reading that names a LOINC code no analyte claims belongs to nobody**,
 *    and its text is not consulted. This is what stops the panel swallowing
 *    tests it does not contain: HbA1c is `4548-4` and is not an anemia measure,
 *    but its name contains "hemoglobin"; nucleated red cells are `30392-5` and
 *    sit at zero in a healthy patient, but their name contains "RBC". Both used
 *    to land in rows that then plotted them as though they were something else.
 *    A record that named itself in LOINC has already said what it is.
 * 3. **Otherwise the longest matching keyword wins** — the specificity tiebreak
 *    in {@link keywordHit} — with ties going to list order, so the outcome is
 *    at least stable and statable.
 *
 * Step 2 turns on the coding *system*, not merely on a code being present:
 * keywords exist for records coded in a local dictionary or not usefully coded
 * at all, and those must still be reachable. Only an explicit LOINC coding is
 * treated as the record having identified itself.
 */
export function assignReadings(
    analytes: readonly AnalyteSpec[],
    observations: readonly Observation[]
): Map<Observation, number> {
    const owners = new Map<Observation, number>();

    for (const obs of observations) {
        const byCode = analytes.findIndex(analyte => codeHit(analyte, obs));

        if (byCode !== -1) {
            owners.set(obs, byCode);
            continue;
        }

        // Coded in LOINC, and no analyte wanted that code: the reading is some
        // other test, and its name is not evidence to the contrary.
        const loincCoded = (obs.code?.coding ?? []).some(coding =>
            coding.code !== undefined && coding.system === "http://loinc.org");

        if (loincCoded) continue;

        let best = -1;
        let bestLen = 0;

        analytes.forEach((analyte, index) => {
            const length = keywordHit(analyte, obs);

            if (length > bestLen) {
                bestLen = length;
                best = index;
            }
        });

        if (best !== -1) owners.set(obs, best);
    }

    return owners;
}
