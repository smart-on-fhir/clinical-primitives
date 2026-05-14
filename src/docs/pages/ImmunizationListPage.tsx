import { useEffect, useRef }   from "react";
import { useClinicalData }      from "../..";
import { ImmunizationList }     from "../../components/Immunization/ImmunizationList";
import { ClinicalPageHeader }   from "../components/ClinicalPageHeader";
import { CodeBlock }            from "../components/CodeBlock";
import type { Immunization }    from "fhir/r4";
import bundle                   from "../samplePatientBundle.json";


export function ImmunizationListPage() {
    const { resources, loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    const immunizations = resources?.Immunization as unknown as Immunization[] | undefined;

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="ImmunizationList" />
            <p className="cp-text-txt-4 mb-6">
                Displays a patient's immunization history grouped by status (completed, not-done, etc.).
                Items are sorted by occurrence date descending. Each row shows the vaccine name,
                occurrence date, lot number, route, and status reason where available.
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
                        <td className="pr-6 py-1"><code>immunizations</code></td>
                        <td className="pr-6 py-1"><code>Immunization[]</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">Array of FHIR R4 <code>Immunization</code> resources.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Panel heading. Defaults to <code>"Immunizations"</code>.</td>
                    </tr>
                </tbody>
            </table>

            {/* Status tabs */}
            <h3 className="mb-3">Status Groups</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Immunizations are grouped by <code>status</code> and shown as filter tabs in the
                following order:
            </p>
            <div className="flex flex-wrap gap-2 mb-8 text-sm">
                {['completed', 'not-done', 'entered-in-error'].map(s => (
                    <code key={s} className="cp-fill-win-2 rounded px-2 py-1">{s}</code>
                ))}
            </div>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { ImmunizationList } from "clinical-primitives";
import { useClinicalData }   from "clinical-primitives";

function PatientImmunizations() {
    const { resources } = useClinicalData();
    const immunizations = resources?.Immunization ?? [];

    return <ImmunizationList immunizations={immunizations} />;
}`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>

            { !immunizations?.length ? (
                <p className="cp-text-txt-4">Loading sample data…</p>
            ) : (
                <article>
                    <p className="text-sm cp-text-txt-4 mb-3">
                        {immunizations.length} immunizations from the sample bundle, grouped by status.
                        Click the status tabs to filter.
                    </p>
                    <div className="flex" style={{ height: 420 }}>
                        <ImmunizationList immunizations={immunizations} />
                    </div>
                </article>
            )}

        </section>
    );
}
