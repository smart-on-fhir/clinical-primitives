import { useEffect, useRef }   from "react";
import { useClinicalData }      from "../..";
import { EventFeed }            from "../../components/EventFeed";
import { ClinicalPageHeader }   from "../components/ClinicalPageHeader";
import { CodeBlock }            from "../components/CodeBlock";
import bundle                   from "../samplePatientBundle.json";


export function EventFeedPage() {
    const { resources, loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="EventFeed" />
            <p className="cp-text-txt-4 mb-6">
                A chronological patient timeline that aggregates FHIR events across multiple resource
                types into a single, filterable feed. Events are grouped by day (newest first) and can
                be filtered by time range and event kind. Clicking any row opens the raw FHIR resource
                in a <code>SourceDialog</code>.
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
                        <td className="pr-6 py-1"><code>resources</code></td>
                        <td className="pr-6 py-1"><code>{"Record<string, object[]>"}</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">Map of FHIR resource type to array of resources. Typically <code>useClinicalData().resources</code>.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>title</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Header text. Defaults to <code>"Patient timeline"</code>.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>rangeOptions</code></td>
                        <td className="pr-6 py-1"><code>RangeOption[]</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Time-range buttons. Defaults to 7d / 30d / 90d / All.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>defaultRange</code></td>
                        <td className="pr-6 py-1"><code>string</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Label of the initially selected range option. Defaults to <code>"30d"</code>.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>includeTypes</code></td>
                        <td className="pr-6 py-1"><code>EventKind[]</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Which event kinds to include. Defaults to all kinds.</td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>maxHeight</code></td>
                        <td className="pr-6 py-1"><code>number</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Max height of the scrollable body in px. Defaults to <code>480</code>.</td>
                    </tr>
                </tbody>
            </table>

            {/* Event kinds */}
            <h3 className="mb-3">Event Kinds</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Each FHIR resource type is mapped to one of the following kinds, which drives the icon,
                tag label, and filter pill:
            </p>
            <table className="mb-8 text-sm w-full">
                <thead>
                    <tr className="cp-text-txt-4 text-left">
                        <th className="pb-2 pr-6">Kind</th>
                        <th className="pb-2 pr-6">Icon</th>
                        <th className="pb-2 pr-6">Tag</th>
                        <th className="pb-2">Source resources</th>
                    </tr>
                </thead>
                <tbody className="align-top">
                    {[
                        ['alert',        '!',  'Alert',     'Observation with an abnormal status'],
                        ['lab',          'L',  'Lab',       'Observation (category: laboratory)'],
                        ['vitals',       'V',  'Vitals',    'Observation (category: vital-signs)'],
                        ['med',          'Rx', 'Med',       'MedicationAdministration, MedicationRequest'],
                        ['procedure',    'Pr', 'Procedure', 'Procedure'],
                        ['immunization', 'Vx', 'Vaccine',   'Immunization'],
                        ['note',         'N',  'Note / Report', 'DocumentReference, DiagnosticReport'],
                    ].map(([kind, icon, tag, src]) => (
                        <tr key={kind}>
                            <td className="pr-6 py-1"><code>{kind}</code></td>
                            <td className="pr-6 py-1"><code>{icon}</code></td>
                            <td className="pr-6 py-1">{tag}</td>
                            <td className="py-1 cp-text-txt-4">{src}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { EventFeed } from "clinical-primitives";
import { useClinicalData } from "clinical-primitives";

function PatientTimeline() {
    const { resources } = useClinicalData();
    if (!resources) return null;

    return (
        <EventFeed
            resources={resources}
            title="Patient timeline"
            defaultRange="30d"
            maxHeight={520}
        />
    );
}`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>

            { !resources ? (
                <p className="cp-text-txt-4">Loading sample data…</p>
            ) : (
                <article>
                    <p className="text-sm cp-text-txt-4 mb-3">
                        Live feed from the sample bundle. Use the range buttons and filter funnel to explore.
                        Click any row to inspect the raw FHIR resource.
                    </p>
                    <EventFeed
                        resources={resources as Record<string, object[]>}
                        defaultRange="All"
                        maxHeight={800}
                        minHeight={600}
                    />
                </article>
            )}

        </section>
    );
}
