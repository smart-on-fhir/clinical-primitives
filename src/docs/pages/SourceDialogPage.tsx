import { useEffect, useRef, useState } from "react";
import { Button, useClinicalData }     from "../..";
import { SourceDialog }                from "../../components/Dialog/SourceDialog";
import { ClinicalPageHeader }          from "../components/ClinicalPageHeader";
import { CodeBlock }                   from "../components/CodeBlock";
import bundle                          from "../samplePatientBundle.json";


export function SourceDialogPage() {
    const { resources, patient, loadFromBundle } = useClinicalData();
    const [patientOpen,  setPatientOpen]  = useState(false);
    const [obsOpen,      setObsOpen]      = useState(false);
    const [customOpen,   setCustomOpen]   = useState(false);

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    const obs = resources?.Observation?.[0];

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="SourceDialog" />
            <p className="cp-text-txt-4 mb-6">
                A modal dialog for inspecting a raw FHIR resource. Shows a <strong>Tree</strong> tab
                (via <code>FhirResourceJsonViewer</code>) and a syntax-highlighted <strong>JSON</strong> tab.
                Both prepend and append custom tabs are supported.
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
                        <td className="pr-6 py-1"><code>open</code></td>
                        <td className="pr-6 py-1"><code>boolean</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">Whether the dialog is visible.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>onClose</code></td>
                        <td className="pr-6 py-1"><code>() =&gt; void</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">Called when the dialog requests to be closed (backdrop click, Esc key).</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>resource</code></td>
                        <td className="pr-6 py-1"><code>object</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">The FHIR resource (or any object) to inspect.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Dialog header. Defaults to a database icon + "FHIR Resource".</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>icon</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Icon shown in the default title. Defaults to a database icon.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>prependTabs</code></td>
                        <td className="pr-6 py-1"><code>TabDefinition[]</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Extra tabs inserted before the Tree/JSON tabs.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>appendTabs</code></td>
                        <td className="pr-6 py-1"><code>TabDefinition[]</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Extra tabs inserted after the Tree/JSON tabs.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>style</code></td>
                        <td className="pr-6 py-1"><code>CSSProperties</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Overrides for the dialog container. Useful for <code>width</code>, <code>minWidth</code>, <code>maxWidth</code>, <code>height</code>.</td>
                    </tr>
                </tbody>
            </table>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { SourceDialog } from "clinical-primitives";

const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>Inspect Resource</Button>

<SourceDialog
    open={open}
    onClose={() => setOpen(false)}
    resource={observation}
/>`}</CodeBlock>

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
                            Opens the Patient resource in the default Tree / JSON view.
                            References to other resources expand inline in the Tree tab.
                        </p>
                        <Button
                            variant="link"
                            hard
                            className="cp-px-4 cp-py-3"
                            onClick={() => setPatientOpen(true)}
                            disabled={!patient}
                        >
                            Open Patient
                        </Button>
                        { patient && patientOpen &&
                            <SourceDialog
                                open={true}
                                onClose={() => setPatientOpen(false)}
                                resource={patient}
                                title="Patient Resource"
                            />
                        }
                    </article>

                    {/* Observation */}
                    <article>
                        <h4 className="mb-2">Observation resource</h4>
                        <p className="text-sm cp-text-txt-4 mb-3">
                            Same dialog on an Observation — note how the <code>subject</code> reference
                            expands inline to the Patient in the Tree tab.
                        </p>
                        <Button
                            variant="link"
                            hard
                            className="cp-px-4 cp-py-3"
                            onClick={() => setObsOpen(true)}
                            disabled={!obs}
                        >
                            Open Observation
                        </Button>
                        { obs && obsOpen &&
                            <SourceDialog
                                open={true}
                                onClose={() => setObsOpen(false)}
                                resource={obs}
                            />
                        }
                    </article>

                    {/* Custom tabs */}
                    <article>
                        <h4 className="mb-2">With custom prepend tab</h4>
                        <p className="text-sm cp-text-txt-4 mb-3">
                            Use <code>prependTabs</code> or <code>appendTabs</code> to inject
                            additional views alongside the built-in Tree / JSON tabs.
                        </p>
                        <Button
                            variant="link"
                            hard
                            className="cp-px-4 cp-py-3"
                            onClick={() => setCustomOpen(true)}
                            disabled={!patient}
                        >
                            Open with Custom Tab
                        </Button>
                        { patient && customOpen &&
                            <SourceDialog
                                open={true}
                                onClose={() => setCustomOpen(false)}
                                resource={patient}
                                prependTabs={[{
                                    label: "Summary",
                                    content: (
                                        <div className="text-sm cp-text-txt-4 p-2">
                                            <p><strong>Name:</strong> {[patient.name?.[0]?.given?.join(' '), patient.name?.[0]?.family].filter(Boolean).join(' ')}</p>
                                            <p><strong>DOB:</strong> {patient.birthDate ?? '—'}</p>
                                            <p><strong>Gender:</strong> {patient.gender ?? '—'}</p>
                                        </div>
                                    )
                                }]}
                            />
                        }
                    </article>

                </div>
            )}

        </section>
    );
}
