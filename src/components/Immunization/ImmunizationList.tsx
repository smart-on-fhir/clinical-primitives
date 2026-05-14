import { useState }                from "react";
import ImmunizationStatus          from "./ImmunizationStatus";
import ImmunizationListItem        from "./ImmunizationListItem";
import type { Immunization }       from "fhir/r4";
import { Badge, Button, useClinicalData } from "../..";
import { getName, getOccurrence, getRoute, getStatusReason } from "./utils";
import { Panel, PanelBody, PanelToolbar } from "../Panel/Panel";
import { PanelHeader }             from "../Panel/Panel";
import { AppWindowIcon }           from "lucide-react";


const STATUS_ORDER = ['completed', 'not-done', 'entered-in-error'];

function sortStatusEntries(entries: { status: string }[]): { status: string }[] {
    return [...entries].sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status);
        const bi = STATUS_ORDER.indexOf(b.status);
        if (ai === -1 && bi === -1) return a.status.localeCompare(b.status);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

export function ImmunizationList({ immunizations, title }: { immunizations: Immunization[], title?: string }) {
    const [tabIndex, setTabIndex] = useState(0);

    const groups = (immunizations || []).reduce<Record<string, Immunization[]>>((acc, i) => {
        const key = i.status ?? 'unknown';
        (acc[key] ??= []).push(i);
        return acc;
    }, {});
    const statusEntries = sortStatusEntries(Object.keys(groups).map(s => ({ status: s })));

    const current     = statusEntries[tabIndex];
    const items       = current ? (groups[current.status] ?? []) : [];
    const sortedItems = [...items].sort((a, b) =>
        (getOccurrence(b) ?? '').localeCompare(getOccurrence(a) ?? '')
    );

    return (
        <Panel className="card" style={{ flex: '1 1 auto' }}>
            <PanelHeader
                title={title || 'Immunizations'}
                icon={<AppWindowIcon />}
                rightContent={<Badge className="cp-text-xs" variant="muted">{immunizations.length}</Badge>}
            />
            {statusEntries.length > 0 && (
                <PanelToolbar className="cp-text-sm cp-text-txt-6">
                    {statusEntries.map((e, idx) => (
                        <Button
                            key={idx}
                            onClick={() => setTabIndex(idx)}
                            radius="pill"
                            virtual={tabIndex !== idx}
                            className="cp-px-3 cp-py-2"
                        >
                            <ImmunizationStatus status={e.status} />
                        </Button>
                    ))}
                </PanelToolbar>
            )}
            <PanelBody style={{ overflow: 'auto' }}>
                <div className="cp-list">
                    {sortedItems.length > 0 ? sortedItems.map((i, idx) => (
                        <ImmunizationListItem
                            key={idx}
                            name={getName(i)}
                            status={i.status}
                            occurrenceDate={getOccurrence(i)}
                            occurrenceString={i.occurrenceString}
                            statusReason={getStatusReason(i)}
                            lotNumber={i.lotNumber ?? null}
                            route={getRoute(i)}
                            resource={i}
                        />
                    )) : (
                        <div className='cp-p-6 cp-text-sm cp-text-win-7' style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>No immunizations available</div>
                    )}
                </div>
            </PanelBody>
            {/* <PanelFooter>Some footer content</PanelFooter> */}
        </Panel>
    );
}

export function ImmunizationListWrapper({ title } : { title?: string }) {
    const { resources } = useClinicalData();
    const immunizations = resources?.Immunization || [];
    return <ImmunizationList immunizations={immunizations as unknown as Immunization[]} title={title} />;
}
