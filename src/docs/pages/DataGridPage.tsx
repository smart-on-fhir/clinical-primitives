import { useEffect, useRef, useState } from 'react';
import { DataGrid }                    from '../../components/DataGrid/DataGrid';
import { DataGridColumn }              from '../../components/DataGrid/types';
import FhirDataGrid                    from '../../components/DataGrid/FhirDataGrid';
import { useClinicalData }             from '../../library';
import bundle                          from "../samplePatientBundle.json";


const PATIENTS = [
    { id: 'pt-001', name: 'Alice Johnson',   age: 34, status: 'Active',    dob: '1990-03-12', score: 82.5, notes: 'Routine follow-up, no acute complaints.' },
    { id: 'pt-002', name: 'Bob Martinez',    age: 52, status: 'Inactive',  dob: '1972-07-04', score: 61.0, notes: 'Discharged after completing physical therapy program.' },
    { id: 'pt-003', name: 'Carol Smith',     age: 28, status: 'Active',    dob: '1996-11-23', score: 95.3, notes: 'New patient intake, no prior history on file.' },
    { id: 'pt-004', name: 'David Lee',       age: 45, status: 'Pending',   dob: '1979-01-30', score: 74.1, notes: 'Awaiting lab results before next appointment.' },
    { id: 'pt-005', name: 'Eva Brown',       age: 61, status: 'Active',    dob: '1963-06-15', score: 88.7, notes: 'Managing hypertension, stable on current medication.' },
    { id: 'pt-006', name: 'Frank Wilson',    age: 39, status: 'Inactive',  dob: '1985-09-08', score: 55.2, notes: 'Moved out of network, records archived.' },
    { id: 'pt-007', name: 'Grace Taylor',    age: 47, status: 'Active',    dob: '1977-12-01', score: 91.4, notes: 'Responding well to treatment, next review in 3 months.' },
    { id: 'pt-008', name: 'Henry Anderson',  age: 33, status: 'Pending',   dob: '1991-05-19', score: 68.9, notes: 'Referral to specialist submitted, awaiting scheduling.' },
];

const COLUMNS: DataGridColumn[] = [
    { propName: 'id',     label: 'ID',     dataType: 'id',     sortProp: 'id',    },
    { propName: 'name',   label: 'Name',   dataType: 'string', sortProp: 'name'   },
    { propName: 'age',    label: 'Age',    dataType: 'number', sortProp: 'age'    },
    { propName: 'dob',    label: 'DOB',    dataType: 'date',   sortProp: 'dob'    },
    { propName: 'status', label: 'Status', dataType: 'string', sortProp: 'status' },
    { propName: 'score',  label: 'Score',  dataType: 'number', sortProp: 'score'  },
    { propName: 'notes',  label: 'Notes',  dataType: 'string', sortProp: 'notes'  },
];

export function DataGridPage() {

    const { loadFromBundle, selectFile, resources, patient } = useClinicalData();

    const [selection, setSelection]   = useState<(string | number)[]>([]);
    const [sortColumn, setSortColumn] = useState('name');
    const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc');
    const [search, setSearch]         = useState('');
    const [offset, setOffset]         = useState(0);
    const limit = 5;

    const matching = search
        ? PATIENTS.filter(p => Object.values(p).some(v => String(v).toLowerCase().includes(search.toLowerCase())))
        : PATIENTS;

    const sorted = [...matching].sort((a, b) => {
        const av = (a as any)[sortColumn];
        const bv = (b as any)[sortColumn];
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return sortDir === 'asc' ? cmp : -cmp;
    });

    const page = sorted.slice(offset, offset + limit);

    const [lastNavigated, setLastNavigated] = useState<string | null>(null);
    const [navSortColumn, setNavSortColumn] = useState('');
    const [navSortDir, setNavSortDir]       = useState<'asc' | 'desc'>('asc');

    const navRows = navSortColumn
        ? [...PATIENTS].sort((a, b) => {
            const av = (a as any)[navSortColumn];
            const bv = (b as any)[navSortColumn];
            if (av === bv) return 0;
            const cmp = av < bv ? -1 : 1;
            return navSortDir === 'asc' ? cmp : -cmp;
        })
        : PATIENTS;

    const [resourceType, setResourceType] = useState("Patient");

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        loadFromBundle(bundle as any);
    }, []);

    const encounters = resources?.[resourceType] as any[] | undefined;

    return (
        <section>
            <header className="text-sky-500 uppercase mb-8">DataGrid</header>

            <article className="mb-12">
                <h3 className="mb-2">Basics</h3>
                <p className="mb-4 cp-text-txt-5">
                    A controlled component, the same way <code>Pagination</code> is: it holds no
                    data of its own. <code>rows</code> is only the current page, <code>count</code>
                    is the total across every page, and <code>offset</code>/<code>limit</code>
                    describe the window <code>rows</code> represents. Sorting, filtering, searching
                    and paging the underlying data are all the caller&apos;s job — the grid only
                    reports what the reader asked for, through <code>onSortChange</code>,{' '}
                    <code>onSearchChange</code> and <code>onPaginationChange</code>.
                </p>
                <p className="mb-4 cp-text-txt-5">
                    Selection works the same way: pass <code>identity</code> (the row property that
                    uniquely identifies a row) together with <code>selection</code> and{' '}
                    <code>onSelectionChange</code>, and the grid manages checkboxes against that
                    array. Only columns with a <code>sortProp</code> are clickable to sort — here,
                    every column has one except <code>Notes</code>.
                </p>
                <div className="cp-fill-win-6 cp-fill-opacity-10 cp-rounded-lg p-4">
                    <DataGrid
                        title="Patients"
                        columns={COLUMNS}
                        rows={page}
                        count={matching.length}
                        limit={limit}
                        offset={offset}
                        identity="id"
                        selection={selection}
                        onSelectionChange={setSelection}
                        sortColumn={sortColumn}
                        sortDir={sortDir}
                        onSortChange={(col, dir) => { setSortColumn(col); setSortDir(dir); setOffset(0); }}
                        onPaginationChange={setOffset}
                        search={search}
                        onSearchChange={s => { setSearch(s); setOffset(0); }}
                    />
                </div>
                <p className="cp-text-txt-5 mt-3">
                    <code>sortColumn={JSON.stringify(sortColumn)}</code>{' '}
                    <code>sortDir={JSON.stringify(sortDir)}</code>{' '}
                    <code>search={JSON.stringify(search)}</code>{' '}
                    <code>selection=[{selection.join(', ')}]</code>
                </p>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Resizable columns</h3>
                <p className="mb-4 cp-text-txt-5">
                    Every column but the last gets a drag handle on its right edge, in the grid
                    above. The last visible column — <code>Notes</code>, unless you hide it from
                    the gear menu — never gets one: it always absorbs whatever space the others
                    don&apos;t use, so the table has no gap on the right and no dead space to
                    scroll into. Shrink the window or drag another column wider and{' '}
                    <code>Notes</code> gives way instead of overflowing.
                </p>
                <p className="mb-4 cp-text-txt-5">
                    Double-clicking a handle releases that column back to &quot;auto&quot; — it
                    behaves exactly like <code>Notes</code> from then on, sharing the remaining
                    space and tracking the container's width, until the next manual drag pins it
                    to a fixed size again. Try it on <code>Score</code>.
                </p>
                <p className="cp-text-txt-5">
                    A column can also start with a preferred size via <code>width</code> and a
                    floor via <code>minWidth</code> on its <code>DataGridColumn</code> — neither is
                    set here, so every column's initial width is just whatever its header and first
                    page of content need.
                </p>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Row navigation</h3>
                <p className="mb-4 cp-text-txt-5">
                    Passing <code>onNavigate</code> adds a leading arrow column — for drilling into
                    a row's detail view, say — separate from selection and unaffected by which data
                    columns are visible.
                </p>
                <div className="cp-fill-win-6 cp-fill-opacity-10 cp-rounded-lg p-4">
                    <DataGrid
                        title="Patients"
                        columns={COLUMNS}
                        rows={navRows.slice(0, 5)}
                        count={5}
                        limit={5}
                        offset={0}
                        identity="id"
                        sortColumn={navSortColumn}
                        sortDir={navSortDir}
                        onSortChange={(col, dir) => { setNavSortColumn(col); setNavSortDir(dir); }}
                        onNavigate={row => setLastNavigated(row.name)}
                    />
                </div>
                <p className="cp-text-txt-5 mt-3">
                    { lastNavigated
                        ? <>Last navigated: <code>{lastNavigated}</code></>
                        : <>Click a row's arrow to navigate.</>
                    }
                </p>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Inferred columns</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>FhirDataGrid</code> wraps <code>DataGrid</code> for FHIR resources
                    whose shape isn't known ahead of time: it infers one column per property found
                    across the first resources it sees, rather than taking a fixed{' '}
                    <code>columns</code> list. A column only sorts if every value it saw was a
                    scalar — CodeableConcepts, References and arrays render fine but can't be
                    compared, so those columns show no sort icon. Search matches anywhere in the
                    resource, including fields with no column shown, though only scalar values
                    that make it onto the page get highlighted.
                </p>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <select
                        value={resourceType}
                        onChange={e => setResourceType(e.target.value)}
                    >
                        { Object.keys(resources || {}).map(rt => <option key={rt} value={rt}>{rt}</option>) }
                    </select>
                    <button onClick={selectFile}>Select Patient Bundle</button>
                    { patient
                        ? <span className="text-sm cp-text-txt-4">
                            Patient: <strong>
                                { [patient.name?.[0]?.given?.join(' '), patient.name?.[0]?.family].filter(Boolean).join(' ') || patient.id }
                            </strong>
                          </span>
                        : <span className="text-sm cp-text-txt-4">Using sample data</span>
                    }
                </div>
                <div className="cp-fill-win-6 cp-fill-opacity-10 cp-rounded-lg p-4">
                    <FhirDataGrid
                        key={resourceType} // force remount when resource type changes to reset internal state
                        resources={encounters || PATIENTS as any[]} // fallback to patients if the bundle hasn't loaded yet
                    />
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Notes</h3>
                <ul className="cp-text-txt-5" style={{ paddingLeft: '1.2em', listStyle: 'disc' }}>
                    <li className="mb-2">
                        Nothing here is fetched or filtered internally beyond what's described
                        above — search highlighting is the one exception, since it needs the
                        current search term regardless of who does the filtering, so it works even
                        if <code>onSearchChange</code> is never wired up.
                    </li>
                    <li className="mb-2">
                        Column visibility (the gear menu) is the grid's own state, not a prop —
                        there's no <code>onColumnVisibilityChange</code> to persist it elsewhere.
                    </li>
                    <li className="mb-2">
                        <code>filters</code> / <code>onFilterChange</code> exist on{' '}
                        <code>DataGridProps</code> but no filter UI reads them yet — they're a
                        placeholder for a caller-built filter panel.
                    </li>
                    <li className="mb-2">
                        With zero rows and <code>loading</code> not set, the grid renders
                        &quot;No records found&quot; in the body rather than an empty table.
                    </li>
                </ul>
            </article>
        </section>
    );
}
