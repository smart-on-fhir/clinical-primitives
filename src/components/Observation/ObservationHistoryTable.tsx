import { ChevronDown, ChevronsUpDown, ChevronUp }  from "lucide-react";
import { useState }                                from "react";
import { getObservationDate, getObservationValue } from "./utils";
import { Observation }                             from "fhir/r4";
import "./ObservationHistoryTable.scss";


type SortCol = 'date' | 'value';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, active, dir }: { col: SortCol; active: SortCol; dir: SortDir }) {
    if (col !== active) return <ChevronsUpDown size={12} className="chevron" style={{ opacity: 0.4 }} />;
    return dir === 'asc'
        ? <ChevronUp size={12} className="chevron" />
        : <ChevronDown size={12} className="chevron" />;
}

export function ObservationHistoryTable({ history }: { history: Observation[] }  ) {
    const [sortCol, setSortCol] = useState<SortCol>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const handleSort = (col: SortCol) => {
        if (col === sortCol) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir(col === 'date' ? 'desc' : 'asc');
        }
    };

    const sorted = [...history].sort((a, b) => {
        let cmp = 0;
        if (sortCol === 'date') {
            const ta = getObservationDate(a)?.getTime() ?? 0;
            const tb = getObservationDate(b)?.getTime() ?? 0;
            cmp = ta - tb;
        } else {
            const va = getObservationValue(a).value ?? '';
            const vb = getObservationValue(b).value ?? '';
            const na = parseFloat(va), nb = parseFloat(vb);
            cmp = !isNaN(na) && !isNaN(nb) ? na - nb : va.localeCompare(vb);
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    if (sorted.length === 0) {
        return <p style={{ padding: '1rem', color: 'var(--cp-color-txt-7)' }}>No readings recorded.</p>;
    }

    const thStyle: React.CSSProperties = {
        cursor    : 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
    };

    return (
        <div className="cp-obs-history-body">
            <table className="cp-obs-history-table">
                <thead>
                    <tr>
                        <th style={thStyle} onClick={() => handleSort('date')}>
                            Date <SortIcon col="date" active={sortCol} dir={sortDir} />
                        </th>
                        <th style={thStyle} onClick={() => handleSort('value')}>
                            Value <SortIcon col="value" active={sortCol} dir={sortDir} />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((obs, i) => {
                        const d = getObservationDate(obs);
                        const { value: v, unit: u } = getObservationValue(obs);
                        return (
                            <tr key={obs.id ? `${obs.id}-${i}` : i}>
                                <td>{d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                                <td>
                                    {v || '—'}
                                    {u && <span className="cp-obs-history-unit"> {u}</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}