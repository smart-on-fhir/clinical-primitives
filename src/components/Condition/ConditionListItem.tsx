import { useState }     from "react";
import { DateDisplay }  from "../Date/DateDisplay";
import { SourceDialog } from "../Dialog/SourceDialog";
import { ListItem }     from "../List/ListItem";
import { Dot }          from "../Dot";


const DOT_COLOR: Record<string, string> = {
    active    : 'var(--cp-color-red)',
    recurrence: 'var(--cp-color-amber)',
    relapse   : 'var(--cp-color-amber)',
    remission : 'var(--cp-color-info)',
    inactive  : 'var(--cp-color-teal)',
    resolved  : 'var(--cp-color-green)',
};

function dotColor(status?: string | null): string {
    return DOT_COLOR[(status ?? '').toLowerCase()] ?? 'var(--cp-color-win-7)';
}


export default function ConditionListItem({
    name,
    clinicalStatus,
    verificationStatus,
    onsetDate,
    abatementDate,
    bodySite,
    decoration,
    resource,
}: {
    name               : string;
    clinicalStatus?    : string | null;
    verificationStatus?: string | null;
    onsetDate?         : string | Date | null;
    abatementDate?     : string | Date | null;
    bodySite?          : string | null;
    decoration?        : React.ReactNode;
    resource?          : object;
}) {
    const [open, setOpen] = useState(false);
    const clickable = !!resource;

    return (
        <>
            <ListItem onClick={clickable ? () => setOpen(true) : undefined}>
                <Dot color={dotColor(clinicalStatus)} title={clinicalStatus ?? undefined} />
                <div style={{ flex: 1 }}>
                    <div className='cp-fw-500 cp-text-txt-3'>{name}</div>
                    <div className='cp-text-txt-6 cp-text-sm cp-fw-300'>
                        <div style={{ display: 'flex', gap: '2ch', alignItems: 'center', flexWrap: 'wrap' }}>
                            {onsetDate    && <span><span className='cp-text-teal'>Onset:</span> <DateDisplay date={onsetDate} /></span>}
                            {abatementDate && <span><span className='cp-text-teal'>Resolved:</span> <DateDisplay date={abatementDate} /></span>}
                            {bodySite     && <span><span className='cp-text-teal'>Site:</span> {bodySite}</span>}
                            {verificationStatus && verificationStatus !== 'confirmed' && (
                                <span className='cp-text-amber'>{verificationStatus}</span>
                            )}
                        </div>
                    </div>
                </div>
                {decoration && <div>{decoration}</div>}
            </ListItem>
            {clickable && <SourceDialog open={open} onClose={() => setOpen(false)} resource={resource} />}
        </>
    );
}

