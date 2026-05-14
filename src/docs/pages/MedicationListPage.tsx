import { useEffect, useRef }      from "react";
import { useClinicalData }         from "../..";
import { MedicationList }          from "../../components/Medication/MedicationList";
import { ClinicalPageHeader }      from "../components/ClinicalPageHeader";
import { CodeBlock }               from "../components/CodeBlock";
import type { MedicationRequest }  from "fhir/r4";
import bundle                      from "../samplePatientBundle.json";


export function MedicationListPage() {
    const { resources, loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    const medications = resources?.MedicationRequest as unknown as MedicationRequest[] | undefined;

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="MedicationList" />
            <p className="cp-text-txt-4 mb-6">
                Displays a patient's medications grouped by status (active, completed, stopped, etc.).
                Items are sorted by authored date descending. Each row shows the medication name,
                dosage instructions, reason, and a source-view button.
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
                        <td className="pr-6 py-1"><code>medications</code></td>
                        <td className="pr-6 py-1"><code>MedicationRequest[] | MedicationAdministration[]</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">
                            Array of FHIR R4 <code>MedicationRequest</code> or <code>MedicationAdministration</code> resources.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Panel heading. Defaults to <code>"Medications"</code>.</td>
                    </tr>
                </tbody>
            </table>

            {/* Status tabs */}
            <h3 className="mb-3">Status Groups</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Medications are grouped by their <code>status</code> field. Common values and their
                tab color:
            </p>
            <table className="mb-8 text-sm">
                <tbody>
                    {[
                        ['active',           'success'],
                        ['completed',        'link'],
                        ['stopped',          'warning'],
                        ['inactive',         'muted'],
                        ['entered-in-error', 'danger'],
                    ].map(([status, color]) => (
                        <tr key={status}>
                            <td className="pr-6 py-1"><code>{status}</code></td>
                            <td className="py-1 cp-text-txt-4">{color} tab style</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { MedicationList } from "clinical-primitives";
import { useClinicalData } from "clinical-primitives";

function PatientMedications() {
    const { resources } = useClinicalData();
    const medications = resources?.MedicationRequest ?? [];

    return <MedicationList medications={medications} />;
}`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>

            { !medications?.length ? (
                <p className="cp-text-txt-4">Loading sample data…</p>
            ) : (
                <article>
                    <p className="text-sm cp-text-txt-4 mb-3">
                        {medications.length} medication requests from the sample bundle, grouped by status.
                        Click the status tabs to filter.
                    </p>
                    <div className="flex" style={{ height: 420 }}>
                        <MedicationList medications={medications} />
                    </div>
                </article>
            )}

        </section>
    );
}
