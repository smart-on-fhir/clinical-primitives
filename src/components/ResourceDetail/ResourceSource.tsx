import { useState }               from "react";
import { ExternalLink }           from "lucide-react";
import type { Resource }          from "fhir/r4";
import { FhirResourceJsonViewer } from "../JsonViewer/FhirJsonViewer";
import { Collapse }               from "../Collapse";
import { SourceDialog }           from "../Dialog/SourceDialog";
import { useClinicalData }        from "../../fhir/context";
import "./ResourceDetail.scss";


/**
 * The "Source" entry at the foot of a resource detail panel: a collapsed tree
 * of the resource itself, with a button that opens it in the full source
 * dialog.
 *
 * The source is not a debugging aid in these panels: a detail that shows less
 * than the reader expected is indistinguishable from a record that has less
 * until the resource can be seen.
 *
 * Meant to sit inside a `.cp-resource-detail` element, which styles its label.
 * Requires `ClinicalDataProvider`, for reference resolution in the tree.
 */
export function ResourceSource({ resource }: { resource: Resource }) {
    const { resources } = useClinicalData();

    const [sourceDialogOpen, setSourceDialogOpen] = useState(false);

    return (
        <>
            <Collapse
                label={
                    <span className="cp-resource-source-label">
                        Source
                        <button
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
                        </button>
                    </span>
                }
            >
                <FhirResourceJsonViewer resource={resource} allResources={resources} />
            </Collapse>

            <SourceDialog
                open={sourceDialogOpen}
                onClose={() => setSourceDialogOpen(false)}
                resource={resource}
            />
        </>
    );
}
