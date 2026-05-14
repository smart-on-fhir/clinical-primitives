import { useEffect, useRef }   from "react";
import { useClinicalData }      from "../..";
import { ObservationCard }      from "../../components/Observation";
import { ClinicalPageHeader }   from "../components/ClinicalPageHeader";
import { CodeBlock }            from "../components/CodeBlock";
import type { Observation }     from "fhir/r4";
import bundle                   from "../samplePatientBundle.json";


export function ObservationCardPage() {
    const { resources, loadFromBundle } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    // Group observations by display name — same logic as ClinicalComponentsPage
    const groups: Record<string, Observation[]> = {};
    if (resources?.Observation) {
        for (const obs of resources.Observation as unknown as Observation[]) {
            const name = (obs as any).code?.coding?.[0]?.display || (obs as any).code?.text || 'Observation';
            (groups[name] ??= []).push(obs);
        }
    }
    const groupList = Object.values(groups);

    // Pick three representative groups for individual examples
    const single   = groupList.find(g => g.length === 1);
    const withHist = groupList.find(g => g.length > 3);
    const abnormal = groupList.find(g => g.some(o => {
        const interp = (o as any).interpretation?.[0]?.coding?.[0]?.code;
        return interp && ['H', 'L', 'HH', 'LL', 'A'].includes(interp);
    }));

    return (
        <section className="mt-4 max-w-4xl">

            <ClinicalPageHeader title="ObservationCard" />
            <p className="cp-text-txt-4 mb-6">
                Compact card for a single FHIR Observation. Shows the observation name, current value
                with units, a trend sparkline from historical readings, a delta from the previous value,
                and a clinical status colour (normal / warning / abnormal). Clicking the info icon opens
                a full history table in a <code>SourceDialog</code>.
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
                        <td className="pr-6 py-1"><code>observation</code></td>
                        <td className="pr-6 py-1"><code>Observation</code></td>
                        <td className="pr-6 py-1">Yes</td>
                        <td className="py-1">
                            The FHIR R4 <code>Observation</code> to display as the current value.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>history</code></td>
                        <td className="pr-6 py-1"><code>Observation[]</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">
                            Prior observations of the same type (any order). Used to generate the
                            sparkline, compute the delta from previous value, and populate the
                            history table in the detail dialog. Pass all observations of the same
                            name — the component will filter and sort internally.
                        </td>
                    </tr>
                    <tr>
                        <td className="pr-6 py-1"><code>style</code></td>
                        <td className="pr-6 py-1"><code>CSSProperties</code></td>
                        <td className="pr-6 py-1">No</td>
                        <td className="py-1">Inline styles for the card container. Useful for constraining <code>maxWidth</code>.</td>
                    </tr>
                </tbody>
            </table>

            {/* Status colours */}
            <h3 className="mb-3">Clinical Status</h3>
            <p className="text-sm cp-text-txt-4 mb-4">
                Derived from <code>interpretation[0].coding[0].code</code>. Affects the sparkline
                colour and card accent:
            </p>
            <table className="mb-8 text-sm">
                <tbody>
                    {[
                        ['normal',   'Green sparkline',  'N, within reference range'],
                        ['warn',     'Amber sparkline',  'H, L — mildly out of range'],
                        ['abnormal', 'Red sparkline',    'HH, LL, A, AA — critically out of range'],
                    ].map(([status, color, codes]) => (
                        <tr key={status}>
                            <td className="pr-6 py-1"><code>{status}</code></td>
                            <td className="pr-6 py-1 cp-text-txt-4">{color}</td>
                            <td className="py-1 cp-text-txt-4">{codes}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { ObservationCard } from "clinical-primitives";

// Single card — latest reading, with history for sparkline + delta
<ObservationCard
    observation={latestObs}
    history={allObsOfSameType}
    style={{ maxWidth: 140 }}
/>`}</CodeBlock>

            {/* Examples */}
            <h3 className="mb-4">Examples</h3>

            { !groupList.length ? (
                <p className="cp-text-txt-4">Loading sample data…</p>
            ) : (
                <div className="flex flex-col gap-10">

                    {/* Individual examples */}
                    <article>
                        <h4 className="mb-2">Individual cards</h4>
                        <p className="text-sm cp-text-txt-4 mb-4">
                            Three representative cards from the sample bundle showing different
                            data states.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            { single && (
                                <div>
                                    <p className="text-xs cp-text-txt-4 mb-2">Single reading (no sparkline)</p>
                                    <ObservationCard
                                        observation={single[single.length - 1]}
                                        history={single}
                                        style={{ maxWidth: 160 }}
                                    />
                                </div>
                            )}
                            { withHist && (
                                <div>
                                    <p className="text-xs cp-text-txt-4 mb-2">With history + sparkline</p>
                                    <ObservationCard
                                        observation={withHist[withHist.length - 1]}
                                        history={withHist}
                                        style={{ maxWidth: 160 }}
                                    />
                                </div>
                            )}
                            { abnormal && (
                                <div>
                                    <p className="text-xs cp-text-txt-4 mb-2">Abnormal value</p>
                                    <ObservationCard
                                        observation={abnormal[abnormal.length - 1]}
                                        history={abnormal}
                                        style={{ maxWidth: 160 }}
                                    />
                                </div>
                            )}
                        </div>
                    </article>

                    {/* Full grid */}
                    <article>
                        <h4 className="mb-2">All observations — responsive grid</h4>
                        <p className="text-sm cp-text-txt-4 mb-4">
                            All {groupList.length} observation types from the sample bundle.
                            Click the <strong>ⓘ</strong> icon on any card to see the full reading history.
                        </p>
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                            { groupList.map(group => (
                                <ObservationCard
                                    key={group[group.length - 1].id}
                                    observation={group[group.length - 1]}
                                    history={group}
                                />
                            ))}
                        </div>
                    </article>

                </div>
            )}

        </section>
    );
}
