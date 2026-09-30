import { Fragment } from "react";
import type { MedicationAdministration, MedicationRequest } from "fhir/r4";
import { ResourceSource } from "../../../ResourceDetail/ResourceSource";
import { formatMedicationPeriod } from "./formatPeriod";
import {
    getMedicationDosages, getMedicationName, getMedicationPeriod,
    getShortMedicationName
} from "../../../../lib/Medication";

/** Shown in the timeline sidebar when a medication bar is clicked. */
export function MedicationDetail({ medication }: {
    medication: MedicationRequest | MedicationAdministration
}) {

    const period  = getMedicationPeriod(medication);
    const dates   = period ? formatMedicationPeriod(period) : null;
    const full    = getMedicationName(medication);
    const short   = getShortMedicationName(medication);
    const dosages = getMedicationDosages(medication);

    return (
        <div className="cp-resource-detail">
            <dl>
                <dt>Medication</dt>
                <dd>
                    <b>{short ?? "Unnamed medication"}</b>
                    { full && full !== short && <p className="cp-text-txt-4">{full}</p> }
                </dd>

                <dt>Status</dt>
                <dd>{medication.status ?? "unknown"}</dd>

                {/* Both dates widen to include clock times when the course
                    starts and ends on the same day — otherwise the two rows
                    would show an identical date and read as a data fault. */}
                <dt>Started</dt>
                <dd>{dates ? dates.start : "unknown"}</dd>

                <dt>Ended</dt>
                {/* An absent end is not the same as no end — the resource simply
                    never recorded one, which is worth saying out loud rather than
                    leaving blank. */}
                <dd>{dates?.end ?? "not recorded"}</dd>

                {/* Nothing here is guaranteed — a resource may carry only a
                    free-text sig, only a coded dose, or no dosing at all — so
                    every row appears on its own terms rather than as a fixed
                    set with blanks. */}
                { dosages.map((dosage, index) => (
                    <Fragment key={index}>
                        {/* Numbered only when there is more than one, which
                            means a taper or a loading dose: the order is the
                            information, so it has to be visible. */}
                        { dosages.length > 1 &&
                            <dt className="cp-timeline-dosage-step">
                                Step {dosage.sequence ?? index + 1}
                            </dt> }

                        { dosage.dose && <><dt>Dose</dt><dd>{dosage.dose}</dd></> }
                        { dosage.rate && <><dt>Rate</dt><dd>{dosage.rate}</dd></> }

                        { (dosage.frequency || dosage.asNeeded) &&
                            <>
                                <dt>Frequency</dt>
                                <dd>{[dosage.frequency, dosage.asNeeded].filter(Boolean).join(", ")}</dd>
                            </> }

                        { dosage.times  && <><dt>Times</dt ><dd>{dosage.times }</dd></> }
                        { dosage.route  && <><dt>Route</dt ><dd>{dosage.route }</dd></> }
                        { dosage.method && <><dt>Method</dt><dd>{dosage.method}</dd></> }
                        { dosage.site   && <><dt>Site</dt  ><dd>{dosage.site  }</dd></> }

                        {/* The prescriber's own wording, last, because the rows
                            above are a reading of it and this is the source. */}
                        { dosage.text &&
                            <>
                                <dt>Instructions</dt>
                                <dd className="cp-text-txt-4">{dosage.text}</dd>
                            </> }
                    </Fragment>
                )) }
            </dl>

            <ResourceSource resource={medication} />
        </div>
    );
}
