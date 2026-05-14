import { useEffect, useRef }    from "react";
import { useClinicalData }      from "../..";
import { LabTrendPanel }        from "../../components/Observation/LabTrendPanel";
import { ClinicalPageHeader }   from "../components/ClinicalPageHeader";
import { CodeBlock }            from "../components/CodeBlock";
import bundle                   from "../samplePatientBundle.json";
import { LABS }                 from "../../components/Observation/ObservationFilters";

export function LabTrendPanelPage() {
    const { loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="LabTrendPanel" />
            <p className="cp-text-txt-4 mb-6">
                A compact panel that renders a table of lab trends. Each row shows the most recent
                value, a mini sparkline of historical readings, the reference range, and an
                interpretation flag. Rows are matched to observations by LOINC codes or
                case-insensitive keywords. Built-in presets are available via the <code>LABS</code>
                {' '}constant — pass a key string instead of a full <code>LabTrendEntry</code> object.
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
                        <td className="pr-6 py-1"><code>labs</code></td>
                        <td className="pr-6 py-1"><code>(LabTrendEntry | LabKey)[]</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">
                            Ordered list of rows to show. Each item is either a <code>LabTrendEntry</code> object
                            or a string key from the built-in <code>LABS</code> preset map.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Panel header title. Defaults to <code>"Lab Trends"</code>.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>meta</code></td>
                        <td className="pr-6 py-1"><code>ReactNode</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Optional subtitle rendered at the right of the panel header, e.g. <code>"Last 5 draws"</code>.</td>
                    </tr>
                </tbody>
            </table>

            {/* LabTrendEntry type */}
            <h3 className="mb-3">LabTrendEntry Shape</h3>
            <p className="text-sm cp-text-txt-4 mb-3">
                Pass a custom <code>LabTrendEntry</code> when the built-in presets don't cover your
                lab. At least one of <code>loincs</code> or <code>keywords</code> must be provided
                for matching to work.
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
                        <td className="py-1">Display name shown in the row.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>loincs</code></td>
                        <td className="pr-6 py-1"><code>readonly string[]</code></td>
                        <td className="py-1">LOINC or SNOMED codes matched against <code>code.coding[].code</code>.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>keywords</code></td>
                        <td className="pr-6 py-1"><code>readonly string[]</code></td>
                        <td className="py-1">Case-insensitive keywords matched against code text and display values. Used as a fallback when no LOINC codes match.</td>
                    </tr>
                </tbody>
            </table>

            {/* Built-in presets */}
            <h3 className="mb-3">Built-in LABS Presets</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Pass any of these string keys directly in the <code>labs</code> array as a shorthand:
            </p>
            <div className="flex flex-wrap gap-2 mb-8 text-sm">
                {[
                    'Hemoglobin', 'WBC', 'Platelets', 'Hematocrit',
                    'Sodium', 'Potassium', 'Chloride', 'Bicarbonate', 'BUN', 'Creatinine', 'Glucose',
                    'ALT', 'AST', 'AlkPhos', 'TotalBili',
                    'Albumin', 'TotalProtein',
                    'CRP', 'ESR', 'Ferritin', 'Iron', 'TIBC', 'Transferrin',
                    'Calprotectin', 'ANCA',
                    'TSH', 'FreeT4', 'Calcium', 'Magnesium', 'Phosphorus',
                    'Triglycerides', 'TotalCholesterol', 'HDL', 'LDL',
                    'INR', 'PTT',
                    'VitaminD', 'VitaminB12', 'Folate',
                    'HIV', 'HepBsAg', 'HepBsAb', 'HepCAb',
                    'CMV', 'EBV', 'CDiff', 'SARS2',
                    'Cocaine', 'Opiates', 'THC', 'Amphetamines', 'Benzodiazepines',
                ].map(k => (
                    <code key={k} className="cp-fill-win-2 rounded px-2 py-1">{k}</code>
                ))}
            </div>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { LabTrendPanel } from "clinical-primitives";

// Using built-in presets
<LabTrendPanel
    title="Lab Trends"
    meta="Most recent right"
    labs={['Hemoglobin', 'WBC', 'Platelets', 'Creatinine', 'BUN']}
/>

// Custom entry
<LabTrendPanel
    labs={[
        { label: 'Lactoferrin', loincs: ['57698-3'], keywords: ['lactoferrin'] },
        'CRP',
        'ESR',
    ]}
/>`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>
            <p className="text-sm cp-text-txt-4 mb-3">
                Live panel from the sample bundle showing a CBC + metabolic selection.
            </p>
            <div className="mb-8" style={{ maxWidth: '700px' }}>
                <LabTrendPanel
                    title="Lab Trends"
                    meta={<span className="cp-text-xs cp-text-txt-7">Most recent right</span>}
                    labs={Object.keys(LABS) as (keyof typeof LABS)[]}
                />
            </div>
        </section>
    );
}
