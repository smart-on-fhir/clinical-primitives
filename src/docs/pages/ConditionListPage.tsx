import { useEffect, useRef }   from "react";
import { useClinicalData }      from "../..";
import { ConditionList }        from "../../components/Condition/ConditionList";
import { ClinicalPageHeader }   from "../components/ClinicalPageHeader";
import { CodeBlock }            from "../components/CodeBlock";
import type { Condition }       from "fhir/r4";
import bundle                   from "../samplePatientBundle.json";


export function ConditionListPage() {
    const { resources, loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    const conditions = resources?.Condition as unknown as Condition[] | undefined;

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="ConditionList" />
            <p className="cp-text-txt-4 mb-6">
                Displays a patient's conditions grouped by clinical status (active, resolved, remission, etc.).
                Status groups are shown as filter tabs ordered by clinical relevance. Items are sorted
                by onset date descending within each group.
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
                        <td className="pr-6 py-1"><code>conditions</code></td>
                        <td className="pr-6 py-1"><code>Condition[]</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">Array of FHIR R4 <code>Condition</code> resources.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Panel heading. Defaults to <code>"Conditions"</code>.</td>
                    </tr>
                </tbody>
            </table>

            {/* Status tabs */}
            <h3 className="mb-3">Status Groups</h3>
            <p className="text-sm cp-text-txt-4 mb-8">
                Conditions are grouped by <code>clinicalStatus.coding[].code</code> and presented
                as filter tabs in the following order:
            </p>
            <div className="flex flex-wrap gap-2 mb-8 text-sm">
                {[
                    ['active',     'danger'],
                    ['recurrence', 'warning'],
                    ['relapse',    'warning'],
                    ['remission',  'info'],
                    ['inactive',   'info'],
                    ['resolved',   'success'],
                    ['unknown',    'muted'],
                ].map(([label, _]) => (
                    <code key={label} className="cp-fill-win-2 rounded px-2 py-1">{label}</code>
                ))}
            </div>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { ConditionList } from "clinical-primitives";
import { useClinicalData } from "clinical-primitives";

function PatientConditions() {
    const { resources } = useClinicalData();
    const conditions = resources?.Condition ?? [];

    return <ConditionList conditions={conditions} title="Problems" />;
}`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>

            { !conditions?.length ? (
                <p className="cp-text-txt-4">Loading sample data…</p>
            ) : (
                <article>
                    <p className="text-sm cp-text-txt-4 mb-3">
                        {conditions.length} conditions from the sample bundle, grouped by clinical status.
                        Click the status tabs to filter.
                    </p>
                    <div className="flex" style={{ height: 420 }}>
                        <ConditionList conditions={conditions} />
                    </div>
                </article>
            )}

        </section>
    );
}
