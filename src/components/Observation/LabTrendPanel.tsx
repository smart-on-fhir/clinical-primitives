import React, { useRef, useState, type ReactNode } from 'react';
import type { Observation }         from 'fhir/r4';
import { Sparkline }                from '../Sparkline';
import type { SparklineSeries }     from '../Sparkline/utils';
import { computeMultiSparklines }     from '../Sparkline/utils';
import {
    getObservationDate,
    getObservationStatus,
    getObservationValue,
    extractObservationNumericValue,
    SPARKLINE_MAX_POINTS,
} from './utils';
import './LabTrendPanel.scss';
import { Panel, PanelBody, PanelHeader } from '../Panel/Panel';
import { LABS } from './ObservationFilters';
import { useClinicalData } from '../../library';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabTrendEntry = {
    /** Display label for the row */
    label: string;
    /** LOINC or SNOMED codes to match against the observation's code.coding */
    loincs?: readonly string[];
    /** Case-insensitive keywords matched against the observation code text / display */
    keywords?: readonly string[];
};

// ---------------------------------------------------------------------------
// Observation matching
// ---------------------------------------------------------------------------

function matchesEntry(obs: Observation, entry: LabTrendEntry): boolean {
    if (entry.loincs?.length) {
        const obsCodes = new Set((obs.code?.coding ?? []).map(c => c.code).filter(Boolean));
        if (entry.loincs.some(c => obsCodes.has(c))) return true;
    }
    if (entry.keywords?.length) {
        const haystack = [obs.code?.text, ...(obs.code?.coding ?? []).map(c => c.display)]
            .filter(Boolean).join(' ').toLowerCase();
        if (entry.keywords.some(kw => haystack.includes(kw.toLowerCase()))) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Row data computation
// ---------------------------------------------------------------------------

type RowData = {
    label:       string;
    value:       string;
    unit:        string | null;
    status:      ReturnType<typeof getObservationStatus>;
    flag:        string;
    refRangeStr: string | null;
    series:      SparklineSeries[];
};

function computeRowData(entry: LabTrendEntry, allObs: Observation[]): RowData | null {
    const matching = allObs.filter(obs => matchesEntry(obs, entry));
    if (matching.length === 0) return null;

    const sortedDesc = [...matching].sort(
        (a, b) => (getObservationDate(b)?.getTime() ?? 0) - (getObservationDate(a)?.getTime() ?? 0)
    );
    const current = sortedDesc[0];
    const sortedAsc = [...sortedDesc].reverse();

    const date = getObservationDate(current);
    const half = Math.floor(SPARKLINE_MAX_POINTS / 2);
    const observations: Observation[] = (() => {
        if (!date) return sortedAsc.slice(-SPARKLINE_MAX_POINTS);
        const ct      = date.getTime();
        const before  = sortedAsc.filter(o => (getObservationDate(o)?.getTime() ?? 0) <= ct);
        const after   = sortedAsc.filter(o => (getObservationDate(o)?.getTime() ?? 0) > ct);
        const after$  = Math.min(after.length,  half);
        const before$ = Math.min(before.length, SPARKLINE_MAX_POINTS - after$);
        return [...before.slice(-before$), ...after.slice(0, after$)];
    })();

    const { value, unit } = getObservationValue(current);

    // Reference range — scan all observations for the first usable range,
    // matching what computeMultiSparklines does internally.
    let refLo: number | undefined;
    let refHi: number | undefined;
    for (const obs of observations) {
        const rr = obs.referenceRange?.[0];
        if (!rr) continue;
        const lo = rr.low?.value;
        const hi = rr.high?.value;
        if (lo !== undefined || hi !== undefined) { refLo = lo; refHi = hi; break; }
    }

    // Compute status from the observation; if it has no referenceRange but we
    // found one from an older observation, evaluate the current numeric value
    // against that range using the same thresholds as getObservationStatus.
    let status = getObservationStatus(current);
    if (status !== 'abnormal' && !current.referenceRange?.length && (refLo !== undefined || refHi !== undefined)) {
        const n = extractObservationNumericValue(current);
        if (n !== null) {
            if (refLo !== undefined && n < refLo) {
                const width = refHi !== undefined ? refHi - refLo : undefined;
                const ratio = width !== undefined && width > 0 ? (refLo - n) / width : undefined;
                status = ratio !== undefined && ratio > 0.25 ? 'abnormal' : 'warn';
            } else if (refHi !== undefined && n > refHi) {
                const width = refLo !== undefined ? refHi - refLo : undefined;
                const ratio = width !== undefined && width > 0 ? (n - refHi) / width : undefined;
                status = ratio !== undefined && ratio > 0.25 ? 'abnormal' : 'warn';
            } else if (status === null) {
                status = 'ok';
            }
        }
    }

    const sparkColor = status === 'abnormal' ? 'var(--cp-color-red)'
                     : status === 'warn'     ? 'var(--cp-color-amber)'
                     : 'var(--cp-color-txt-6)';
    const series = computeMultiSparklines(observations, {
        sparkColor,
        observation: current,
        lineWidth: 1.5,
    });

    const refRangeStr = refLo !== undefined && refHi !== undefined
        ? `Ref ${refLo}–${refHi}`
        : refLo !== undefined ? `Ref ≥ ${refLo}`
        : refHi !== undefined ? `Ref ≤ ${refHi}`
        : null;

    // Flag: prefer explicit interpretation codes, fall back to computed status
    const interpCodes = (current.interpretation ?? [])
        .flatMap(i => i.coding ?? [])
        .map(c => (c.code ?? '').toUpperCase());
    let flag = '—';
    if      (interpCodes.some(c => c === 'HH')) flag = '↑↑';
    else if (interpCodes.some(c => c === 'H'))  flag = '↑H';
    else if (interpCodes.some(c => c === 'LL')) flag = '↓↓';
    else if (interpCodes.some(c => c === 'L'))  flag = '↓L';
    else if (status === 'abnormal')             flag = '!';
    else if (status === 'warn')                 flag = '↑';

    return { label: entry.label, value, unit, status, flag, refRangeStr, series };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabTrendPanel({
    title = "Lab Trends",
    meta,
    labs,
}: {
    /** Panel header title */
    title?: ReactNode;
    /** Optional subtitle, e.g. "Last 5 draws · most recent right" */
    meta?: ReactNode;
    /** Ordered list of lab entries to display */
    labs: (LabTrendEntry | keyof typeof LABS)[];
}) {
    const { resources } = useClinicalData();
    const allObs = (resources.Observation ?? []) as unknown as Observation[];

    const rows = labs
        .map(entry => {
            const e = typeof entry === 'string' ? LABS[entry] : entry;
            if (!e) {
                console.warn(`LabTrendPanel: unknown lab "${entry}"`);
                return null;
            }
            return computeRowData(e, allObs);
        })
        .filter((r): r is RowData => r !== null);

    const containerRef = useRef<HTMLDivElement>(null);
    const tbodyRef     = useRef<HTMLTableSectionElement>(null);
    const [crosshairLeft, setCrosshairLeft] = useState<number | null>(null);

    function handleMouseMove(e: React.MouseEvent) {
        const sparkTd = tbodyRef.current?.querySelector<HTMLElement>('.lt-spark');
        if (!sparkTd || !containerRef.current) return;
        const sparkRect     = sparkTd.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const mx = e.clientX;
        if (mx >= sparkRect.left && mx <= sparkRect.right) {
            setCrosshairLeft(mx - containerRect.left);
        } else {
            setCrosshairLeft(null);
        }
    }

    if (rows.length === 0) return null;

    return (
        <Panel className="card text-muted">
            <PanelHeader title={title} rightContent={meta} />
            <PanelBody>
                <div ref={containerRef} style={{ position: 'relative' }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setCrosshairLeft(null)}
                >
                    {crosshairLeft !== null && (
                        <div style={{
                            position    : 'absolute',
                            left        : crosshairLeft,
                            top         : 0,
                            bottom      : 0,
                            width       : 1,
                            opacity     : 0.2,
                            pointerEvents: 'none',
                            zIndex      : 1,
                            borderRight : '1px dashed var(--cp-color-txt-3)',
                        }} />
                    )}
                    <table className='lt-panel-table'>
                        <tbody ref={tbodyRef}>
                            {rows.map((row, i) => (
                                <tr key={i} className={`lt-row${row.status ? ` ${row.status}` : ''}`}>
                                    <td>
                                        <div className="lt-name">{row.label}</div>
                                        {row.refRangeStr && <div className="lt-ref">{row.refRangeStr}</div>}
                                    </td>
                                    <td className='lt-spark'>
                                        {row.series.length > 0 && <Sparkline series={row.series} height={30} />}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', justifyContent: 'space-between' }}>
                                            <div>
                                                <div className={`lt-value${row.status ? ` lt-${row.status}` : ''}`}>{row.value}</div>
                                                <div className="lt-unit">{row.unit || ""}</div>
                                            </div>
                                            <b className={`lt-flag${row.status ? ` lt-${row.status}` : ''}`}>{row.flag}</b>
                                        </div>
                                    </td>
                                    {/* <td className={`lt-value${row.status ? ` lt-${row.status}` : ''}`}>{row.value}</td> */}
                                    {/* <td className="lt-unit">{row.unit || ""}</td> */}
                                    {/* <td className={`lt-flag${row.status ? ` lt-${row.status}` : ''}`}>
                                        <b>{row.flag}</b>
                                    </td> */}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </PanelBody>
        </Panel>
    );
}
