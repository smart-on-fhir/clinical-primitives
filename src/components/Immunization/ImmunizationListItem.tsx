import { useState }     from "react";
import { SourceDialog } from "../Dialog/SourceDialog";
import { ListItem }     from "../List/ListItem";
import { DateDisplay }  from "../Date/DateDisplay";
import { Dot }          from "../Dot";


const DOT_COLOR: Record<string, string> = {
    'completed'       : 'var(--cp-color-green)',
    'not-done'        : 'var(--cp-color-txt-7)',
    'entered-in-error': 'var(--cp-color-red)',
};

function dotColor(status?: string | null): string {
    return DOT_COLOR[status ?? ''] ?? 'var(--cp-color-txt-7)';
}


export default function ImmunizationListItem({
    name,
    status,
    occurrenceDate,
    occurrenceString,
    statusReason,
    lotNumber,
    route,
    decoration,
    resource,
}: {
    name             : string;
    status?          : string | null;
    occurrenceDate?  : string | null;
    occurrenceString?: string | null;
    statusReason?    : string | null;
    lotNumber?       : string | null;
    route?           : string | null;
    decoration?      : React.ReactNode;
    resource?        : object;
}) {
    const [open, setOpen] = useState(false);
    const clickable = !!resource;

    return (
        <>
            <ListItem onClick={clickable ? () => setOpen(true) : undefined}>
                <Dot color={dotColor(status)} title={status ?? undefined} />
                <div style={{ flex: 1 }}>
                    <div className='cp-fw-500 cp-text-txt-3'>{name}</div>
                    <div className='cp-text-txt-6 cp-text-sm cp-mt-1 cp-fw-300'>
                        <div style={{ display: 'flex', gap: '2ch', alignItems: 'center', flexWrap: 'wrap' }}>
                            {occurrenceDate   && <span><DateDisplay  date={occurrenceDate} /></span>}
                            {!occurrenceDate && occurrenceString && <span>{occurrenceString}</span>}
                            {route            && <span>{route}</span>}
                            {lotNumber        && <span><span className='cp-text-teal'>Lot:</span> {lotNumber}</span>}
                            {statusReason     && <span className='cp-text-amber'>{statusReason}</span>}
                        </div>
                    </div>
                </div>
                {decoration && <div>{decoration}</div>}
            </ListItem>
            {clickable && <SourceDialog open={open} onClose={() => setOpen(false)} resource={resource} />}
        </>
    );
}
