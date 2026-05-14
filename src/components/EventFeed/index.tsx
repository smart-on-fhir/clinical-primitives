import { useState, useMemo, useRef, useEffect } from 'react';
import { SourceDialog } from '../Dialog/SourceDialog';
import type {
    DiagnosticReport,
    DocumentReference,
    Immunization,
    MedicationAdministration,
    MedicationRequest,
    Observation,
    Procedure,
} from 'fhir/r4';
import {
    getObservationDate,
    getObservationDisplayName,
    getObservationStatus,
    getObservationValue,
} from '../Observation/utils';
import './EventFeed.scss';
import { Badge } from '../Badge/Badge';
import { FunnelIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventKind = 'alert' | 'lab' | 'med' | 'note' | 'procedure' | 'immunization' | 'vitals';

type FeedEvent = {
    id       : string;
    kind     : EventKind;
    timestamp: Date;
    title    : string;
    subtitle?: string;
    tag      : string;
    resource : object;
};

export type RangeOption = { label: string; days: number | null };

const DEFAULT_RANGES: RangeOption[] = [
    { label: '7d',  days: 7  },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: 'All', days: null },
];

// ---------------------------------------------------------------------------
// FHIR extraction helpers
// ---------------------------------------------------------------------------

function obsToEvents(observations: Observation[]): FeedEvent[] {
    return observations.flatMap((obs): FeedEvent[] => {
        const date = getObservationDate(obs);
        if (!date) return [];
        const { value, unit } = getObservationValue(obs);
        if (!value) return [];

        const name = getObservationDisplayName(obs);
        const cats = (obs.category ?? []).flatMap(c => (c.coding ?? []).map(cd => cd.code));
        const isVital = cats.includes('vital-signs');
        const status  = getObservationStatus(obs);

        const kind: EventKind = status === 'abnormal' ? 'alert' : isVital ? 'vitals' : 'lab';
        const tag              = status === 'abnormal' ? 'Alert' : isVital ? 'Vitals' : 'Lab';

        // Reference range subtitle
        const refRange = obs.referenceRange?.[0];
        const lo = refRange?.low?.value;
        const hi = refRange?.high?.value;
        const refStr = lo !== undefined && hi !== undefined ? `Ref ${lo}–${hi}${unit ? ` ${unit}` : ''}`
                     : hi !== undefined                    ? `Ref \u2264 ${hi}${unit ? ` ${unit}` : ''}`
                     : lo !== undefined                    ? `Ref \u2265 ${lo}${unit ? ` ${unit}` : ''}`
                     : undefined;

        return [{
            id       : obs.id ?? `obs-${date.getTime()}`,
            kind,
            timestamp: date,
            title    : `${name} \u2014 ${value}${unit ? ` ${unit}` : ''}`,
            subtitle : refStr,
            tag,
            resource : obs,
        }];
    });
}

function medAdminToEvents(admins: MedicationAdministration[]): FeedEvent[] {
    return admins.flatMap((ma): FeedEvent[] => {
        const dateStr = (ma as any).effectiveDateTime || (ma as any).effectivePeriod?.start;
        if (!dateStr) return [];
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return [];

        const name = (ma as any).medicationCodeableConcept?.text
            || (ma as any).medicationCodeableConcept?.coding?.[0]?.display
            || (ma as any).medicationReference?.display
            || 'Medication';

        const dose    = (ma as any).dosage?.dose;
        const doseStr = dose?.value != null ? `${dose.value}${dose.unit ? ` ${dose.unit}` : ''}` : null;
        const route   = (ma as any).dosage?.route?.text
            || (ma as any).dosage?.route?.coding?.[0]?.display;

        return [{
            id       : (ma as any).id ?? `ma-${date.getTime()}`,
            kind     : 'med',
            timestamp: date,
            title    : `${name}${doseStr ? ` ${doseStr}` : ''} administered`,
            subtitle : route || undefined,
            tag      : 'Med',
            resource : ma,
        }];
    });
}

function medRequestToEvents(requests: MedicationRequest[]): FeedEvent[] {
    return requests.flatMap((mr): FeedEvent[] => {
        const dateStr = mr.authoredOn;
        if (!dateStr) return [];
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return [];

        // Skip cancelled/entered-in-error to reduce noise
        if (mr.status === 'cancelled' || mr.status === 'entered-in-error') return [];

        const name = (mr as any).medicationCodeableConcept?.text
            || (mr as any).medicationCodeableConcept?.coding?.[0]?.display
            || (mr as any).medicationReference?.display
            || 'Medication';

        const doseInstr = mr.dosageInstruction?.[0];
        const doseQty   = doseInstr?.doseAndRate?.[0]?.doseQuantity;
        const doseStr   = doseQty?.value != null
            ? `${doseQty.value}${doseQty.unit ? ` ${doseQty.unit}` : ''}`
            : null;

        const statusLabel = mr.status === 'active' ? 'Active prescription'
            : mr.status === 'on-hold'  ? 'On hold'
            : mr.status === 'stopped'  ? 'Stopped'
            : mr.status === 'completed'? 'Completed'
            : 'Prescribed';

        return [{
            id       : mr.id ?? `mr-${date.getTime()}`,
            kind     : 'med',
            timestamp: date,
            title    : `${name}${doseStr ? ` ${doseStr}` : ''} prescribed`,
            subtitle : statusLabel,
            tag      : 'Med',
            resource : mr,
        }];
    });
}

function docRefToEvents(docs: DocumentReference[]): FeedEvent[] {
    return docs.flatMap((doc): FeedEvent[] => {
        const dateStr = doc.date || (doc as any).context?.period?.start;
        if (!dateStr) return [];
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return [];

        const title = doc.description
            || doc.type?.text
            || doc.type?.coding?.[0]?.display
            || doc.content?.[0]?.attachment?.title
            || 'Clinical note';

        const category = doc.category?.[0]?.text || doc.category?.[0]?.coding?.[0]?.display;

        return [{
            id       : doc.id ?? `doc-${date.getTime()}`,
            kind     : 'note',
            timestamp: date,
            title,
            subtitle : category || undefined,
            tag      : 'Note',
            resource : doc,
        }];
    });
}

function diagReportToEvents(reports: DiagnosticReport[]): FeedEvent[] {
    return reports.flatMap((dr): FeedEvent[] => {
        const dateStr = dr.effectiveDateTime || dr.issued;
        if (!dateStr) return [];
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return [];

        const title = dr.code?.text || dr.code?.coding?.[0]?.display || 'Report';
        const subtitle = typeof dr.conclusion === 'string' && dr.conclusion.length > 0
            ? dr.conclusion.slice(0, 120)
            : undefined;

        return [{
            id       : dr.id ?? `dr-${date.getTime()}`,
            kind     : 'note',
            timestamp: date,
            title,
            subtitle,
            tag      : 'Report',
            resource : dr,
        }];
    });
}

function procedureToEvents(procedures: Procedure[]): FeedEvent[] {
    return procedures.flatMap((proc): FeedEvent[] => {
        if (proc.status === 'entered-in-error') return [];

        const dateStr = proc.performedDateTime || (proc as any).performedPeriod?.start;
        if (!dateStr) return [];
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return [];

        const name = proc.code?.text || proc.code?.coding?.[0]?.display || 'Procedure';
        const reason = proc.reasonCode?.[0]?.text || proc.reasonCode?.[0]?.coding?.[0]?.display;
        const outcome = proc.outcome?.text || proc.outcome?.coding?.[0]?.display;
        const subtitle = outcome || reason || undefined;

        return [{
            id       : proc.id ?? `proc-${date.getTime()}`,
            kind     : 'procedure',
            timestamp: date,
            title    : name,
            subtitle,
            tag      : 'Procedure',
            resource : proc,
        }];
    });
}

function immunizationToEvents(immunizations: Immunization[]): FeedEvent[] {
    return immunizations.flatMap((imm): FeedEvent[] => {
        if (imm.status === 'entered-in-error') return [];

        const dateStr = imm.occurrenceDateTime || (typeof imm.occurrenceString === 'string' ? imm.occurrenceString : undefined);
        if (!dateStr) return [];
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return [];

        const name = imm.vaccineCode?.text || imm.vaccineCode?.coding?.[0]?.display || 'Vaccine';
        const notDone = imm.status === 'not-done';
        const statusReason = (imm as any).statusReason?.text || (imm as any).statusReason?.coding?.[0]?.display;
        const subtitle = notDone
            ? `Not administered${statusReason ? ` — ${statusReason}` : ''}`
            : imm.lotNumber ? `Lot ${imm.lotNumber}` : undefined;

        return [{
            id       : imm.id ?? `imm-${date.getTime()}`,
            kind     : 'immunization',
            timestamp: date,
            title    : name,
            subtitle,
            tag      : 'Vaccine',
            resource : imm,
        }];
    });
}

// ---------------------------------------------------------------------------
// Fast date extractor — reads only the date string field per resource type,
// used for range pre-filtering before full event conversion.
// ---------------------------------------------------------------------------

function getResourceDateMs(r: any, type: string): number | null {
    let str: string | undefined;
    switch (type) {
        case 'Observation':              str = r.effectiveDateTime ?? r.effectivePeriod?.start; break;
        case 'MedicationAdministration': str = r.effectiveDateTime ?? r.effectivePeriod?.start; break;
        case 'MedicationRequest':        str = r.authoredOn; break;
        case 'DocumentReference':        str = r.date ?? r.context?.period?.start; break;
        case 'DiagnosticReport':         str = r.effectiveDateTime ?? r.issued; break;
        case 'Procedure':                str = r.performedDateTime ?? r.performedPeriod?.start; break;
        case 'Immunization':             str = r.occurrenceDateTime ?? (typeof r.occurrenceString === 'string' ? r.occurrenceString : undefined); break;
    }
    if (!str) return null;
    const ms = new Date(str).getTime();
    return isNaN(ms) ? null : ms;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

const ICON_LABEL: Record<EventKind, string> = {
    alert       : '!',
    lab         : 'L',
    med         : 'Rx',
    note        : 'N',
    procedure   : 'Pr',
    immunization: 'Vx',
    vitals      : 'V',
};

// Stable display order for the type-filter row
const KIND_ORDER: EventKind[] = ['alert', 'lab', 'vitals', 'med', 'procedure', 'immunization', 'note'];

const TAG_LABEL: Record<EventKind, string> = {
    alert       : 'Alert',
    lab         : 'Lab',
    med         : 'Med',
    note        : 'Note',
    procedure   : 'Procedure',
    immunization: 'Vaccine',
    vitals      : 'Vitals',
};

function formatTime(d: Date): string {
    // If time is midnight-ish (likely date-only data), show nothing
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDayLabel(d: Date): string {
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth()    === b.getMonth()    &&
        a.getDate()     === b.getDate();

    if (isSameDay(d, today))     return 'Today';
    if (isSameDay(d, yesterday)) return 'Yesterday';

    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EventRow({ event, onClick }: { event: FeedEvent; onClick: () => void }) {
    const time = formatTime(event.timestamp);
    return (
        <div className="ef-row" onClick={onClick} role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onClick()}
        >
            <span className="ef-time">{time}</span>
            <div className={`ef-icon ef-icon--${event.kind}`}>
                {ICON_LABEL[event.kind]}
            </div>
            <div className="ef-body-text">
                <div className="ef-title">{event.title}</div>
                {event.subtitle && <div className="ef-sub">{event.subtitle}</div>}
            </div>
            <span className="ef-tag">{event.tag || TAG_LABEL[event.kind]}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EventFeed({
    title        = 'Patient timeline',
    rangeOptions = DEFAULT_RANGES,
    defaultRange = '30d',
    includeTypes = ['lab', 'vitals', 'alert', 'med', 'note', 'procedure', 'immunization'],
    maxHeight,
    minHeight,
    resources
}: {
    title?        : string;
    rangeOptions? : RangeOption[];
    /** Label of the initially selected range option */
    defaultRange? : string;
    /** Which event kinds to include */
    includeTypes? : EventKind[];
    /** Max height of the scrollable body in px (default 480) */
    maxHeight?    : number | string;
    /** Min height of the scrollable body in px (default 10em) */
    minHeight?    : number | string;
    /**
     * The FHIR resources to display, keyed by resource type. Observations
     * should include both vitals and labs, as the component distinguishes
     * them by category.
     */
    resources: Record<string, object[]>;
}) {

    const initialRange = rangeOptions.find(r => r.label === defaultRange) ?? rangeOptions[0];
    const [activeRange,   setActiveRange  ] = useState<RangeOption>(initialRange);
    const [activeKinds,   setActiveKinds  ] = useState<Set<EventKind>>(new Set(includeTypes as EventKind[]));
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dialogEvent,  setDialogEvent ] = useState<FeedEvent | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!dropdownOpen) return;
        function onMouseDown(e: MouseEvent) {
            if (filterRef.current?.contains(e.target as Node)) return;
            setDropdownOpen(false);
        }
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [dropdownOpen]);

    function toggleKind(kind: EventKind) {
        setActiveKinds(prev => {
            if (prev.has(kind) && prev.size === 1) return prev; // keep at least one active
            const next = new Set(prev);
            next.has(kind) ? next.delete(kind) : next.add(kind);
            return next;
        });
    }

    // Cheap O(n) scan to find the latest event timestamp across all resource types.
    // Reads only the date string field — no full event conversion.
    const latestEventTs = useMemo(() => {
        const TYPES = ['Observation', 'MedicationAdministration', 'MedicationRequest',
                       'DocumentReference', 'DiagnosticReport', 'Procedure', 'Immunization'];
        let max = -Infinity;
        for (const type of TYPES) {
            for (const r of (resources[type] ?? [])) {
                const ms = getResourceDateMs(r as any, type);
                if (ms !== null && ms > max) max = ms;
            }
        }
        return max === -Infinity ? null : max;
    }, [resources]);

    // Kinds that have at least one event in the full dataset (drives which filter pills to show).
    // Uses resource presence + a single-pass observation category scan — no full conversion.
    const kindsWithData = useMemo<Set<EventKind>>(() => {
        const kinds = new Set<EventKind>();
        const obs = (resources.Observation ?? []) as Observation[];
        for (const o of obs) {
            const cats = (o.category ?? []).flatMap(c => (c.coding ?? []).map(cd => cd.code));
            cats.includes('vital-signs') ? kinds.add('vitals') : kinds.add('lab');
            if ((o.interpretation ?? []).some(i => (i.coding ?? []).length > 0)) kinds.add('alert');
            if (kinds.has('vitals') && kinds.has('lab') && kinds.has('alert')) break; // early exit
        }
        if ((resources.MedicationAdministration?.length ?? 0) > 0 ||
            (resources.MedicationRequest?.length        ?? 0) > 0) kinds.add('med');
        if ((resources.DocumentReference?.length ?? 0) > 0 ||
            (resources.DiagnosticReport?.length  ?? 0) > 0) kinds.add('note');
        if ((resources.Procedure?.length    ?? 0) > 0) kinds.add('procedure');
        if ((resources.Immunization?.length  ?? 0) > 0) kinds.add('immunization');
        return new Set([...kinds].filter(k => (includeTypes as EventKind[]).includes(k)));
    }, [resources, includeTypes]);

    // Convert only resources that fall within the active time window, then filter by kind.
    // Pre-filtering before conversion is the key perf win: avoids running
    // getObservationStatus/Value/DisplayName on observations outside the selected range.
    const { filteredEvents, anchorDate } = useMemo(() => {
        if (latestEventTs === null) return { filteredEvents: [], anchorDate: null };

        let windowStart: number;
        let anchorTs   : number;
        if (activeRange.days === null) {
            windowStart = -Infinity;
            anchorTs    = Infinity;
        } else {
            const windowMs = activeRange.days * 86_400_000;
            const now      = Date.now();
            anchorTs    = latestEventTs >= now - windowMs ? now : latestEventTs;
            windowStart = anchorTs - windowMs;
        }

        function inWindow(r: any, type: string): boolean {
            const ms = getResourceDateMs(r, type);
            return ms !== null && ms >= windowStart && ms <= anchorTs;
        }

        const obs           = ((resources.Observation             ?? []) as Observation[])             .filter(r => inWindow(r, 'Observation'));
        const admins        = ((resources.MedicationAdministration ?? []) as MedicationAdministration[]).filter(r => inWindow(r, 'MedicationAdministration'));
        const requests      = ((resources.MedicationRequest        ?? []) as MedicationRequest[])       .filter(r => inWindow(r, 'MedicationRequest'));
        const docs          = ((resources.DocumentReference        ?? []) as DocumentReference[])        .filter(r => inWindow(r, 'DocumentReference'));
        const reports       = ((resources.DiagnosticReport         ?? []) as DiagnosticReport[])         .filter(r => inWindow(r, 'DiagnosticReport'));
        const procedures    = ((resources.Procedure                ?? []) as Procedure[])                .filter(r => inWindow(r, 'Procedure'));
        const immunizations = ((resources.Immunization             ?? []) as Immunization[])             .filter(r => inWindow(r, 'Immunization'));

        const events = [
            ...obsToEvents(obs),
            ...medAdminToEvents(admins),
            ...medRequestToEvents(requests),
            ...docRefToEvents(docs),
            ...diagReportToEvents(reports),
            ...procedureToEvents(procedures),
            ...immunizationToEvents(immunizations),
        ]
            .filter(e => (includeTypes as EventKind[]).includes(e.kind) && activeKinds.has(e.kind))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        const anchorDate = (activeRange.days !== null && anchorTs < Date.now())
            ? new Date(anchorTs) : null;

        return { filteredEvents: events, anchorDate };
    }, [resources, activeRange, activeKinds, includeTypes, latestEventTs]);

    // Group by day; cap rendered rows to avoid DOM bloat.
    const RENDER_CAP = 300;
    const { days, overflowCount } = useMemo(() => {
        const capped       = filteredEvents.length > RENDER_CAP ? filteredEvents.slice(0, RENDER_CAP) : filteredEvents;
        const overflowCount = filteredEvents.length - capped.length;
        const map = new Map<string, { label: string; events: FeedEvent[] }>();
        for (const event of capped) {
            const key = dayKey(event.timestamp);
            if (!map.has(key)) {
                map.set(key, { label: formatDayLabel(event.timestamp), events: [] });
            }
            map.get(key)!.events.push(event);
        }
        return { days: Array.from(map.values()), overflowCount };
    }, [filteredEvents]);

    return (
        <div className="ef-feed card" style={{ maxHeight, minHeight }}>
            <div className="ef-header">
                <span className="ef-title-text">{title}</span>
                <span className="ef-hint">Newest first</span>
            </div>

            <div className="ef-range-row">
                {rangeOptions.map(opt => (
                    <button
                        key={opt.label}
                        className={`ef-range-btn${activeRange.label === opt.label ? ' active' : ''}`}
                        onClick={() => setActiveRange(opt)}
                    >
                        {opt.label}
                    </button>
                ))}

                {kindsWithData.size > 0 && (() => {
                    const availableKinds = KIND_ORDER.filter(k => kindsWithData.has(k));
                    const allActive = availableKinds.every(k => activeKinds.has(k));
                    return (
                        <div className="ef-filter-wrap" ref={filterRef}>
                            <button
                                className={`ef-filter-btn${!allActive ? ' filtered' : ''}`}
                                onClick={() => setDropdownOpen(o => !o)}
                            >
                                <FunnelIcon size={16} />
                                {!allActive && <span className="ef-filter-badge">{activeKinds.size}</span>}
                            </button>
                            {dropdownOpen && (
                                <div className="ef-dropdown">
                                    {availableKinds.map(kind => (
                                        <label key={kind} className="ef-dropdown-item">
                                            <input
                                                type="checkbox"
                                                checked={activeKinds.has(kind)}
                                                onChange={() => toggleKind(kind)}
                                            />
                                            <span className={`ef-icon ef-icon--${kind} ef-icon--sm p-2`}>
                                                {ICON_LABEL[kind]}
                                            </span>
                                            <span className="ef-dropdown-label">{TAG_LABEL[kind]}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {anchorDate && (
                <div className="ef-anchor-notice">
                    No recent data — showing {activeRange.label} window ending{' '}
                    <strong>{anchorDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                </div>
            )}

            <div className="ef-body">
                {days.length === 0 ? (
                    <div className="ef-empty">No events in this period.</div>
                ) : (
                    <>
                    {days.map(({ label, events }) => (
                        <div key={label}>
                            <div className="ef-day-divider">
                                <span className="ef-day-label">{label}</span>
                                <div className="ef-day-line" />
                                <Badge variant="muted" className='cp-text-xs'>{events.length}</Badge>
                            </div>
                            {events.map(event => (
                                <EventRow
                                    key={event.id}
                                    event={event}
                                    onClick={() => setDialogEvent(event)}
                                />
                            ))}
                        </div>
                    ))}
                    {overflowCount > 0 && (
                        <div className="ef-overflow-notice">
                            {overflowCount} older events not shown — narrow the range or use the filter to see them.
                        </div>
                    )}
                    </>
                )}
            </div>

            {dialogEvent && (
                <SourceDialog
                    open
                    onClose={() => setDialogEvent(null)}
                    resource={dialogEvent.resource}
                    title={dialogEvent.tag}
                />
            )}
        </div>
    );
}
