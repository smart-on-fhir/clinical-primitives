import { useState }     from "react";
import MedicationName   from "./MedicationName";
import { DateDisplay }  from "../Date/DateDisplay";
import { SourceDialog } from "../Dialog/SourceDialog";
import { ListItem }     from "../List/ListItem";
import { Dot }          from "../Dot";


const medClassColors = {
    active            : 'var(--cp-color-green)',
    inactive          : 'var(--cp-color-txt-7)',
    'entered-in-error': 'var(--cp-color-red)',
    stopped           : 'var(--cp-color-amber)',
    completed         : 'var(--cp-color-blue)',
};

export default function MedicationListItem({
    name,
    authoredOn,
    status,
    statusReasonText,
    intent,
    reason,
    dose,
    decoration,
    resource,
}: {
    name             : string;
    authoredOn?      : string | Date | null;
    status?          : string | null;
    statusReasonText?: string | null;
    intent?          : string | null;
    reason?          : string | null;
    dose?            : string | null;
    decoration?      : React.ReactNode;
    resource?        : object;
}) {
    const [open, setOpen] = useState(false);
    const clickable = !!resource;

    return (
        <>
            <ListItem onClick={clickable ? () => setOpen(true) : undefined}>
                <Dot color={status ? medClassColors[status as keyof typeof medClassColors] : 'var(--cp-color-txt-7)'} title={status ?? undefined} />
                <div style={{ flex: 1 }}>
                    <div className='cp-fw-500 cp-text-txt-3'>
                        <MedicationName name={name || ''} />
                    </div>
                    <div className='cp-text-txt-6 cp-text-sm cp-fw-300'>
                        {reason && <div><span className='cp-text-teal'>Reason:</span> <span className=''>{reason}</span></div>}
                        {dose && <span><span className='cp-text-teal'>Dose:</span> {dose}</span>}
                        <div style={{ display: 'flex', gap: '2ch', alignItems: 'center', flexWrap: 'wrap' }}>
                            {authoredOn && <span><span className='cp-text-teal'>Started:</span> <DateDisplay date={authoredOn} /></span>}
                            {statusReasonText && <span className='cp-text-teal'>{statusReasonText}</span>}
                            {intent && <span><span className='cp-text-teal'>Intent:</span> {intent}</span>}
                            
                        </div>
                    </div>
                </div>
                {decoration && <div>{decoration}</div>}
            </ListItem>
            {clickable && <SourceDialog open={open} onClose={() => setOpen(false)} resource={resource} />}
        </>
    );
}