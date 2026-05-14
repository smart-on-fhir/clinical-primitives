import { useEffect, useRef }         from "react";
import { useClinicalData }           from "../..";
import { ObservationsPanel }         from "../../components/Observation/ObservationsPanel";
import { ClinicalPageHeader }        from "../components/ClinicalPageHeader";
import { CodeBlock }                 from "../components/CodeBlock";
import bundle                        from "../samplePatientBundle.json";


export function ObservationsPanelPage() {
    const { loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="ObservationsPanel" />
            <p className="cp-text-txt-4 mb-6">
                A tabbed panel that groups all of a patient's observations by configurable filters.
                Each tab shows a grid of <code>ObservationCard</code>s for the matching observations,
                deduplicated by concept identity and sortable by date or status. A dynamic
                <code> Latest</code> tab is generated automatically when no custom filters are provided,
                showing observations from within 7 days of the most recent recorded value.
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
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Panel heading. Defaults to <code>"Observations"</code>.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>filters</code></td>
                        <td className="pr-6 py-1"><code>FilterKey[]</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            Subset of built-in filter keys to show as tabs.
                            When omitted, shows <code>All</code> + auto-generated <code>Latest</code> tab.
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Built-in filters */}
            <h3 className="mb-3">Built-in Filters</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Pass any combination of these keys to the <code>filters</code> prop to show only those tabs:
            </p>
            <div className="flex flex-wrap gap-2 mb-8 text-sm">
                {['All', 'Vitals', 'Labs', 'Social', 'Activity', 'IBD'].map(f => (
                    <code key={f} className="cp-fill-win-2 rounded px-2 py-1">{f}</code>
                ))}
            </div>

            {/* ObservationFilter type */}
            <h3 className="mb-3">ObservationFilter Shape</h3>
            <p className="text-sm cp-text-txt-4 mb-3">
                Each filter tab is driven by an <code>ObservationFilter</code> object. All fields are
                optional — an empty filter matches everything:
            </p>
            <table className="mb-8 text-sm w-full">
                <thead>
                    <tr className="cp-text-txt-4 text-left">
                        <th className="pb-2 pr-6">Field</th>
                        <th className="pb-2 pr-6">Type</th>
                        <th className="pb-2">Description</th>
                    </tr>
                </thead>
                <tbody className="align-top">
                    <tr>
                        <td className="pr-6 py-1"><code>label</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="py-1">Tab label shown in the UI.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>categories</code></td>
                        <td className="pr-6 py-1"><code>string[]</code></td>
                        <td className="py-1">FHIR category codes to match (e.g. <code>"vital-signs"</code>, <code>"laboratory"</code>).</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>codes</code></td>
                        <td className="pr-6 py-1"><code>string[]</code></td>
                        <td className="py-1">LOINC or SNOMED codes to match against <code>code.coding</code>.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>keywords</code></td>
                        <td className="pr-6 py-1"><code>string[]</code></td>
                        <td className="py-1">Case-insensitive keywords matched against code text and display values.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>after</code></td>
                        <td className="pr-6 py-1"><code>Date</code></td>
                        <td className="py-1">Include observations on or after this date (day-level, inclusive).</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>before</code></td>
                        <td className="pr-6 py-1"><code>Date</code></td>
                        <td className="py-1">Include observations on or before this date (day-level, inclusive).</td>
                    </tr>
                </tbody>
            </table>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { ObservationsPanel } from "clinical-primitives";

// Default — All + auto Latest tab
<ObservationsPanel title="Observations" />

// Selected tabs only
<ObservationsPanel
    title="Labs & Vitals"
    filters={['Vitals', 'Labs', 'IBD']}
/>`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>
            <p className="text-sm cp-text-txt-4 mb-3">
                Live panel from the sample bundle. Use the sort buttons and tabs to explore.
            </p>
            <div className="mb-8 " style={{
                maxWidth: '800px',
                border: '1px solid #CCC',
                borderRadius: '8px',
                overflow: 'hidden',
            }}>
                <ObservationsPanel />
            </div>
        </section>
    );
}
