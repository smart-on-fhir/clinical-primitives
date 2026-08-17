import { Fragment, useState } from "react";
import type { Observation, ObservationComponent } from "fhir/r4";
import { ExternalLink } from "lucide-react";
import { useClinicalData } from "../../../../fhir/context";
import { FhirResourceJsonViewer } from "../../../JsonViewer/FhirJsonViewer";
import { Collapse } from "../../../Collapse";
import { SourceDialog } from "../../../Dialog/SourceDialog";
import { Button } from "../../../Button/Button";
import {
    cleanUnit,
    getObservationDate,
    getObservationDisplayName,
    getObservationValue
} from "../../../Observation/utils";
import { formatTick } from "../../../Observation/ObservationChart";

/** One component's name, as short as the record allows. */
function componentName(component: ObservationComponent): string {
    const coding = (component.code?.coding ?? [])[0];
    return component.code?.text ?? coding?.display ?? coding?.code ?? "Component";
}

/** A quantity as it should read beside its name. */
function quantity(value?: { value?: number, unit?: string }): string | null {
    if (typeof value?.value !== "number" || !Number.isFinite(value.value)) return null;
    return `${formatTick(value.value)}${value.unit ? " " + cleanUnit(value.unit) : ""}`;
}

/**
 * How the laboratory read the result, in its own words.
 *
 * One phrase per interpretation, not one per way of writing it down. A
 * CodeableConcept's codings and its text are the same statement in different
 * vocabularies — a record that says `{coding: [{code: "H", display: "High"}],
 * text: "High"}`, which is the ordinary shape, was being read as three separate
 * findings and printed as "High, High".
 *
 * Displays before text before codes: "High" is what the report said, and `H` is
 * only how it was transmitted. A bare code is still shown where that is all
 * there is — silently dropping it would hide a flag the record does carry.
 */
function interpretations(concepts: Observation["interpretation"]): string[] {
    const phrases = (concepts ?? []).map(concept =>
        (concept.coding ?? []).map(coding => coding.display).find(Boolean)
            ?? concept.text
            ?? (concept.coding ?? []).map(coding => coding.code).find(Boolean)
    );

    const seen = new Set<string>();

    // Repeats across entries are dropped too. A result flagged by both the
    // instrument and the reviewing laboratory carries the finding twice, and it
    // is still one finding.
    return phrases.filter((phrase): phrase is string => {
        const key = phrase?.trim().toLowerCase();

        if (!key || seen.has(key)) return false;

        seen.add(key);
        return true;
    }).map(phrase => phrase.trim());
}

/** An interval as the record states it, quoting its own text where it gave one. */
function referenceRanges(observation: Observation): string[] {
    return (observation.referenceRange ?? []).map(range => {
        if (range.text) return range.text;

        const low  = quantity(range.low);
        const high = quantity(range.high);

        if (low && high) return `${low} – ${high}`;
        if (high) return `≤ ${high}`;
        if (low)  return `≥ ${low}`;

        return "";
    }).filter(Boolean);
}

/**
 * Shown in the timeline sidebar when a reading is clicked.
 *
 * Describes the resource, not the row: the interval quoted here is the one the
 * observation itself carries, whatever limits the reader may have typed over it
 * in the settings panel. Those are a way of looking at the series — this is the
 * record.
 */
export function ObservationDetail({ observation }: { observation: Observation }) {
    const { resources } = useClinicalData();

    const [sourceDialogOpen, setSourceDialogOpen] = useState(false);

    const date       = getObservationDate(observation);
    const value      = getObservationValue(observation);
    const components = (observation.component ?? []).filter(component => quantity(component.valueQuantity));
    const flags      = interpretations(observation.interpretation);
    const ranges     = referenceRanges(observation);

    return (
        <div className="cp-timeline-selection-detail">
            <dl>
                <dt>Observation</dt>
                <dd><b>{getObservationDisplayName(observation)}</b></dd>

                {/* A multi-valued observation lists its components instead. The
                    combined reading — "120/80" — is a convention for blood
                    pressure and says nothing useful for any other pairing, and
                    each component carries its own unit and flags anyway. */}
                { components.length > 0
                    ? components.map((component, index) => (
                        <Fragment key={index}>
                            <dt>{componentName(component)}</dt>
                            <dd>
                                {quantity(component.valueQuantity)}
                                { interpretations(component.interpretation).length > 0 &&
                                    <span className="cp-text-txt-4">
                                        {" "}({interpretations(component.interpretation).join(", ")})
                                    </span> }
                            </dd>
                        </Fragment>
                    ))
                    : <>
                        <dt>Value</dt>
                        <dd>{value.value}{value.unit ? ` ${value.unit}` : ""}</dd>
                    </> }

                {/* Only where the record gave one. An absent flag is not a
                    verdict of normal, and printing "none" would read as one. */}
                { flags.length > 0 &&
                    <>
                        <dt>Interpretation</dt>
                        <dd>{flags.join(", ")}</dd>
                    </> }

                {/* The laboratory's own interval, where the resource quotes it.
                    Most records do not, which is why the chart takes a resolver
                    at all — and why this row is absent far more often than not. */}
                { ranges.length > 0 &&
                    <>
                        <dt>Reference range</dt>
                        <dd>{ranges.join("; ")}</dd>
                    </> }

                <dt>Date</dt>
                {/* With the time, unlike a medication's dates: readings taken
                    the same day are ordinary, and a date alone would make two
                    of them look like duplicates of one another. */}
                <dd>{date ? date.toLocaleString() : "unknown"}</dd>

                <dt>Status</dt>
                <dd>{observation.status ?? "unknown"}</dd>

                { (observation.note ?? []).length > 0 &&
                    <>
                        <dt>Notes</dt>
                        <dd className="cp-text-txt-4">
                            {(observation.note ?? []).map(note => note.text).filter(Boolean).join("\n")}
                        </dd>
                    </> }
            </dl>

            <Collapse
                label={
                    <span className="cp-timeline-source-label">
                        Source
                        <Button
                            virtual
                            title="Open the full resource"
                            onClick={event => {
                                // The whole header toggles the collapse, so the
                                // click has to stop here or opening the dialog
                                // would collapse the tree behind it.
                                event.stopPropagation();
                                setSourceDialogOpen(true);
                            }}
                        >
                            <ExternalLink size={13} style={{ display: "block" }} />
                        </Button>
                    </span>
                }
            >
                <FhirResourceJsonViewer resource={observation} allResources={resources} />
            </Collapse>

            <SourceDialog
                open={sourceDialogOpen}
                onClose={() => setSourceDialogOpen(false)}
                resource={observation}
            />
        </div>
    );
}
