import { useState }           from "react";
import MedicationStatus       from "./MedicationStatus";
import MedicationListItem     from "./MedicationListItem";
import { groupBy }            from "../../utils";
import type { MedicationAdministration, MedicationRequest } from "fhir/r4";
import { Badge, Button, useClinicalData }   from "../..";
import { getMedicationName }                from "./utils";
import { Panel, PanelBody, PanelHeader, PanelToolbar } from "../Panel/Panel";
import { AppWindowIcon }                    from "lucide-react";
import { List } from "../List/List";


const TAB_CLASS: Record<string, string> = {
    active            : 'success',
    inactive          : 'muted',
    'entered-in-error': 'danger',
    stopped           : 'warning',
    completed         : 'link',
};

export function MedicationList({
    medications,
    title = 'Medications',
}: {
    medications: MedicationRequest[] | MedicationAdministration[]
    title?: string;
}) {

    const [tabIndex, setTabIndex] = useState(0);

    // Build status entries keeping the original key alongside the display label
    // so we can look up the group correctly regardless of humanization.
    const groups = groupBy(medications || [], 'status');
    const statusEntries = Object.keys(groups)
        .map(status => ({ status, label: status }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const current    = statusEntries[tabIndex];
    const meds       = (current ? (groups[current.status] ?? []) : []);
    const sortedMeds = [...meds].sort((a, b) => (b.authoredOn ?? '').localeCompare(a.authoredOn ?? ''));

    return (
        <Panel className="card" style={{ flex: '1 1 auto' }}>
            <PanelHeader
                title={title}
                icon={<AppWindowIcon />}
                rightContent={<Badge variant="muted" className="cp-text-xs">{medications.length}</Badge>}
            />
            { meds.length > 0 && (
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
                            <MedicationStatus status={e.label} />
                        </Button>
                    ))}
                </PanelToolbar>
            ) }
            <PanelBody style={{ overflow: 'auto' }}>
                <List>
                    { sortedMeds.length > 0 ? sortedMeds.map((med, idx) => {
                        const name = getMedicationName(med) || 'Unnamed Medication';
                        // const medClass = classifyMedication(med.medication || '');
                        // const classLabel = medClass && medClass !== 'other' ? medClass : null;
                        const reason = med.reasonCode?.[0]?.text ||
                                    med.reasonCode?.[0]?.coding?.[0]?.display ||
                                    med.reasonCode?.[0]?.coding?.[0]?.code ||
                                    null;
                        
                        const dosageInstruction = med.dosageInstruction?.[0];
                        const doseQuantity = dosageInstruction?.doseAndRate?.[0]?.doseQuantity;
                        const dose = doseQuantity
                            ? `${doseQuantity.value} ${doseQuantity.unit}`
                            : dosageInstruction?.text || null;

                        return (
                            <MedicationListItem
                                key={idx}
                                name={name}
                                authoredOn={med.authoredOn}
                                status={med.status}
                                statusReasonText={med.statusReasonText}
                                // decoration={<>
                                //     {classLabel ? <div className={`cp-badge cp-badge-neutral fw-normal`}>{classLabel}</div> : null}
                                // </>}
                                reason={reason}
                                intent={med.intent}
                                dose={dose}
                                resource={med}
                            />
                        );
                    }) : <div className='p-3 cp-text-sm opacity-50'>No medications available</div>}
                </List>
            </PanelBody>
        </Panel>
    );
}

export function MedicationListWrapper({ title } : { title?: string }) {
    const { resources } = useClinicalData();
    const medications = resources?.MedicationRequest || [];
    return <MedicationList medications={medications as unknown as MedicationRequest[]} title={title} />;
}
