import type { Condition }         from "fhir/r4";
import { useState }               from "react";
import ConditionStatus            from "./ConditionStatus";
import ConditionListItem          from "./ConditionListItem";
import { Button }                 from "../Button/Button";
import { List }                   from "../List/List";
import { Badge, useClinicalData } from "../../library";
import {
    getAbatement,
    getBodySite,
    getClinicalStatus,
    getName,
    getOnset,
    getVerificationStatus
} from "./utils";
import { Panel, PanelBody, PanelHeader, PanelToolbar } from "../Panel/Panel";
import { AppWindowIcon } from "lucide-react";


// Group key is the clinicalStatus code; fall back to 'unknown'.
function statusKey(c: Condition): string {
    return getClinicalStatus(c) ?? 'unknown';
}

// Status tab order: active states first, then inactive, unknown last.
const STATUS_ORDER = [
    'active',
    'recurrence',
    'relapse',
    'remission',
    'inactive',
    'resolved',
    'unknown'
];

const TAB_CLASS: Record<string, string> = {
    active    : 'danger',
    recurrence: 'warning',
    relapse   : 'warning',
    remission : 'info',
    inactive  : 'info',
    resolved  : 'success',
    unknown   : 'muted',
};

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

export function ConditionList({ conditions, title="Conditions" }: { conditions: Condition[], title?: string }) {
    const [tabIndex, setTabIndex] = useState(0);

    const groups = (conditions || []).reduce<Record<string, Condition[]>>((acc, c) => {
        const key = statusKey(c);
        (acc[key] ??= []).push(c);
        return acc;
    }, {});
    const statusEntries = sortStatusEntries(Object.keys(groups).map(s => ({ status: s })));

    const current      = statusEntries[tabIndex];
    const items        = (current ? (groups[current.status] ?? []) : []) as Condition[];
    const sortedItems  = [...items].sort((a, b) =>
        (getOnset(b) ?? '').localeCompare(getOnset(a) ?? '')
    );

    return (
        <Panel className="card" style={{ flex: '1 1 auto' }}>
            <PanelHeader
                title={title || 'Conditions'}
                icon={<AppWindowIcon />}
                rightContent={<Badge variant="muted" className="cp-text-xs">{conditions.length}</Badge>}
            />
            {statusEntries.length > 0 && (
                <PanelToolbar className="cp-text-sm cp-text-txt-6">
                    {statusEntries.map((e, idx) => (
                        <Button
                            key={idx}
                            onClick={() => setTabIndex(idx)}
                            radius="pill"
                            virtual={tabIndex !== idx}
                            variant={tabIndex === idx ? TAB_CLASS[e.status] as any : 'muted'}
                            className="cp-px-3 cp-py-2"
                        >
                            <ConditionStatus status={e.status} />
                        </Button>
                    ))}
                </PanelToolbar>
            )}
            <PanelBody style={{ overflow: 'auto' }}>
                <List>
                    {sortedItems.length > 0 ? sortedItems.map((c, idx) => (
                        <ConditionListItem
                            key={idx}
                            name={getName(c)}
                            clinicalStatus={getClinicalStatus(c)}
                            verificationStatus={getVerificationStatus(c)}
                            onsetDate={getOnset(c)}
                            abatementDate={getAbatement(c)}
                            bodySite={getBodySite(c)}
                            resource={c}
                        />
                    )) : (
                        <div className='cp-p-6 cp-text-sm cp-text-win-7' style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>No conditions available</div>
                    )}
                </List>
            </PanelBody>
        </Panel>
    );
}

export function ConditionListWrapper({ title } : { title?: string }) {
    const { resources } = useClinicalData();
    const conditions = resources?.Condition || [];
    return <ConditionList conditions={conditions as unknown as Condition[]} title={title} />;
}
