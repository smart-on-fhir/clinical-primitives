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
                interpretation flag. Rows are matched to observations by LOINC codes or, for
                readings without a usable code, by keywords. Built-in presets are available via
                the <code>LABS</code> constant — pass a key string instead of a full
                {' '}<code>LabTrendEntry</code> object. Every part of a row has a tooltip, so
                mount <code>{'<Tooltip />'}</code> once in your app.
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
                        <td className="py-1">
                            Case-insensitive whole words matched against code text and display
                            values, for readings no row claims by code. A reading coded in LOINC
                            is never matched by keyword — see Matching below.
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Built-in presets */}
            <h3 className="mb-3">Built-in LABS Presets</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Pass any of these string keys directly in the <code>labs</code> array as a shorthand.
                An unknown key is skipped with a console warning.
            </p>
            <div className="flex flex-wrap gap-2 mb-8 text-sm">
                {(Object.keys(LABS) as (keyof typeof LABS)[]).map(k => (
                    <code key={k} className="cp-fill-win-2 rounded px-2 py-1" title={LABS[k].loincs.join(', ')}>{k}</code>
                ))}
            </div>

            {/* Matching */}
            <h3 className="mb-3">Matching</h3>
            <p className="text-sm cp-text-txt-4 mb-3">
                Readings are sorted into rows across the whole panel at once, and each one goes to
                at most one row:
            </p>
            <ul className="text-sm cp-text-txt-4 mb-8" style={{ paddingLeft: '1.2em', listStyle: 'disc' }}>
                <li className="mb-1">
                    <strong>A code beats a keyword.</strong> When two rows list the same code, the
                    earlier row gets the reading.
                </li>
                <li className="mb-1">
                    <strong>A reading coded in LOINC under a code no row lists goes nowhere</strong>,
                    whatever its name says. Hemoglobin A1c (<code>4548-4</code>) has "hemoglobin" in
                    its name but stays out of the Hemoglobin row.
                </li>
                <li className="mb-1">
                    <strong>Otherwise the longest matching keyword wins</strong>, matched as whole
                    words: "prealbumin" beats "albumin", and <code>alt</code> doesn't match "cobalt".
                    Keywords exist for locally coded or uncoded data.
                </li>
            </ul>

            {/* Units */}
            <h3 className="mb-3">Units</h3>
            <p className="text-sm cp-text-txt-4 mb-8">
                Each row is drawn in the latest reading's unit. Older readings in another unit of
                the same kind (mg/dL and mg/L, lb and kg, ×10⁹/L and K/µL) are converted, along with
                their reference ranges. A reading that can't be converted — a molar CRP in a row
                reported in mg/L — is left off the sparkline rather than drawn on the wrong scale,
                and the row says how many were left out.
            </p>

            {/* Flags and tooltips */}
            <h3 className="mb-3">Flags and Tooltips</h3>
            <p className="text-sm cp-text-txt-4 mb-8">
                The flag uses the latest reading's interpretation code when the lab sent one
                (<code>↑↑</code> HH, <code>↑H</code> H, <code>↓L</code> L, <code>↓↓</code> LL),
                and otherwise compares the value with the reference range (<code>↑</code>,
                {' '}<code>↓</code>, or <code>↑↑</code>/<code>↓↓</code> when far outside it). Hover
                any part of a row for an explanation: the name lists the tests the row gathered,
                the range says which reading it came from, the value shows the previous reading,
                the flag says whether the lab or the range raised it, and the sparkline gives the
                span and extremes. Tooltips need <code>{'<Tooltip />'}</code> mounted once.
            </p>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { LabTrendPanel, Tooltip } from "clinical-primitives";

// Once, near the app root, for the row tooltips
<Tooltip />

// Using built-in presets
<LabTrendPanel
    title="Lab Trends"
    meta="Most recent right"
    labs={['Hemoglobin', 'WBC', 'Platelets', 'ALT', 'AST']}
/>

// Presets and custom entries together
<LabTrendPanel
    labs={[
        'CRP',
        'Hemoglobin',
        // No LOINC code: matched by keyword in locally coded data
        { label: 'Lactoferrin', keywords: ['lactoferrin'] },
        // Exact codes only: no keywords, so nothing look-alike leaks in
        { label: 'Albumin', loincs: ['1751-7'] },
        'Weight',
    ]}
/>`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>
            <p className="text-sm cp-text-txt-4 mb-3">
                Live panel from the sample bundle with every preset. Rows with no matching
                readings are left out.
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
