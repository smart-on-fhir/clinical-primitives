import { useEffect, useRef }      from "react";
import { useClinicalData }        from "../..";
import { FhirResourceJsonViewer } from "../../components/JsonViewer/FhirJsonViewer";
import { ClinicalPageHeader }     from "../components/ClinicalPageHeader";
import { CodeBlock }              from "../components/CodeBlock";
import type { Observation }       from "fhir/r4";
import bundle                     from "../samplePatientBundle.json";


export function FhirJsonViewerPage() {
    const { resources, patient, loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    const obsWithRef = (resources?.Observation as unknown as Observation[] | undefined)
        ?.find(o => o.referenceRange?.length);
    const docRef = resources?.DocumentReference?.[0];

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="FhirResourceJsonViewer" />
            <p className="cp-text-txt-4 mb-6">
                A smart JSON tree viewer for FHIR R4 resources. Renders the raw resource structure
                with context-aware decorations: clickable URLs, highlighted dates, inline-expanded
                resource references, and collapsible attachment previews.
            </p>

            <hr className="mb-6" />

            {/* Props */}
            <h3 className="mb-3">Props</h3>
            <table className="mb-8 text-sm w-full">
                <thead>
                    <tr className="cp-text-txt-4 text-left">
                        <th className="pb-2 pr-6">Prop</th>
                        <th className="pb-2 pr-6">Type</th>
                        <th className="pb-2 pr-6">Required</th>
                        <th className="pb-2">Description</th>
                    </tr>
                </thead>
                <tbody className="align-top">
                    <tr>
                        <td className="pr-6 py-1"><code>resource</code></td>
                        <td className="pr-6 py-1"><code>Resource</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">Any FHIR R4 resource to display.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>allResources</code></td>
                        <td className="pr-6 py-1"><code>ResourcesByType</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">
                            The full resource store (<code>Record&lt;string, object[]&gt;</code>).
                            Used to resolve inline references — e.g.&nbsp;
                            <code>subject.reference</code> expands the Patient inline.
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Features */}
            <h3 className="mb-3">Features</h3>
            <ul className="text-sm cp-text-txt-4 mb-8 space-y-1 list-disc list-inside">
                <li>Dates matching <code>YYYY-MM-DD…</code> are highlighted in amber.</li>
                <li>URLs are rendered as external links.</li>
                <li>
                    Fields ending in <code>.reference</code> or <code>.url</code> containing a
                    known <code>ResourceType/id</code> expand the referenced resource inline.
                    Unresolved references are flagged in red.
                </li>
                <li>
                    <code>DocumentReference</code> attachment data is rendered as a collapsible
                    preview instead of the raw base64 string.
                </li>
                <li>Multi-line strings are collapsed with a line count summary.</li>
            </ul>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import FhirResourceJsonViewer from "@clinical-primitives/FhirResourceJsonViewer";
import { useClinicalData }     from "@clinical-primitives";

function MyComponent() {
    const { patient, resources } = useClinicalData();
    if (!patient || !resources) return null;

    return (
        <FhirResourceJsonViewer
            resource={patient}
            allResources={resources}
        />
    );
}`}</CodeBlock>

            {/* Examples */}
            <h3 className="mb-4">Examples</h3>

            { !resources ? (
                <p className="cp-text-txt-4">Loading sample data…</p>
            ) : (
                <div className="flex flex-col gap-8">

                    {/* Patient */}
                    <article>
                        <h4 className="mb-2">Patient resource</h4>
                        <p className="text-sm cp-text-txt-4 mb-3">
                            Shows name, birthDate, identifiers. The <code>managingOrganization</code> reference
                            expands inline if the Organization resource is present in the bundle.
                        </p>
                        <div className="border border-solid cp-border-win-3 rounded-lg overflow-auto cp-fill-win-1 max-h-[360px] p-4 text-sm">
                            { patient
                                ? <FhirResourceJsonViewer resource={patient} allResources={resources} />
                                : <p className="cp-text-txt-4">No patient resource found.</p>
                            }
                        </div>
                    </article>

                    {/* Observation with reference range */}
                    <article>
                        <h4 className="mb-2">Observation with reference range</h4>
                        <p className="text-sm cp-text-txt-4 mb-3">
                            The <code>subject</code> reference resolves inline to the Patient.
                            Dates on <code>effectiveDateTime</code> and <code>issued</code> are
                            highlighted amber.
                        </p>
                        <div className="border border-solid cp-border-win-3 rounded-lg overflow-auto cp-fill-win-1 max-h-[360px] p-4 text-sm">
                            { obsWithRef
                                ? <FhirResourceJsonViewer resource={obsWithRef} allResources={resources} />
                                : <p className="cp-text-txt-4">No observation with a reference range found in sample data.</p>
                            }
                        </div>
                    </article>

                    {/* DocumentReference */}
                    { docRef && (
                        <article>
                            <h4 className="mb-2">DocumentReference with attachment</h4>
                            <p className="text-sm cp-text-txt-4 mb-3">
                                The <code>content[n].attachment.data</code> base64 field is replaced
                                with a collapsible attachment preview instead of the raw string.
                            </p>
                            <div className="border border-solid cp-border-win-3 rounded-lg overflow-auto cp-fill-win-1 max-h-[360px] p-4 text-sm">
                                <FhirResourceJsonViewer resource={docRef as any} allResources={resources} />
                            </div>
                        </article>
                    )}

                </div>
            )}

        </section>
    );
}
