import { Chart } from '../../components/Chart';
import { ClinicalPageHeader } from '../components/ClinicalPageHeader';
import { CodeBlock } from '../components/CodeBlock';

// ── Sample data ──────────────────────────────────────────────────────────────

const monthlyAdmissions = [
    { month: 'Jan', ICU: 42, ED: 110, Ward: 88 },
    { month: 'Feb', ICU: 38, ED: 95,  Ward: 92 },
    { month: 'Mar', ICU: 55, ED: 130, Ward: 101 },
    { month: 'Apr', ICU: 47, ED: 118, Ward: 97 },
    { month: 'May', ICU: 61, ED: 142, Ward: 115 },
    { month: 'Jun', ICU: 53, ED: 125, Ward: 108 },
];

const vitalsOverTime = [
    { time: '08:00', systolic: 122, diastolic: 78 },
    { time: '10:00', systolic: 130, diastolic: 82 },
    { time: '12:00', systolic: 128, diastolic: 80 },
    { time: '14:00', systolic: 135, diastolic: 85 },
    { time: '16:00', systolic: 126, diastolic: 79 },
    { time: '18:00', systolic: 120, diastolic: 76 },
];

const diagnosisCounts = [
    { dx: 'Hypertension',   n: 320 },
    { dx: 'Diabetes T2',    n: 245 },
    { dx: 'COPD',           n: 188 },
    { dx: 'Heart Failure',  n: 154 },
    { dx: 'Asthma',         n: 132 },
];

// Flat data for stratifier demo
const flatAdmissions = [
    { month: 'Jan', dept: 'ICU',  count: 42 },
    { month: 'Jan', dept: 'ED',   count: 110 },
    { month: 'Feb', dept: 'ICU',  count: 38 },
    { month: 'Feb', dept: 'ED',   count: 95 },
    { month: 'Mar', dept: 'ICU',  count: 55 },
    { month: 'Mar', dept: 'ED',   count: 130 },
    { month: 'Apr', dept: 'ICU',  count: 47 },
    { month: 'Apr', dept: 'ED',   count: 118 },
];

// Scatter: BMI vs systolic BP per patient (two cohorts)
const scatterCohortA = [
    { bmi: 22, sbp: 118 }, { bmi: 24, sbp: 122 }, { bmi: 27, sbp: 128 },
    { bmi: 29, sbp: 131 }, { bmi: 31, sbp: 138 }, { bmi: 34, sbp: 144 },
    { bmi: 36, sbp: 150 }, { bmi: 38, sbp: 155 },
];
const scatterCohortB = [
    { bmi: 21, sbp: 112 }, { bmi: 25, sbp: 120 }, { bmi: 28, sbp: 125 },
    { bmi: 30, sbp: 130 }, { bmi: 33, sbp: 136 }, { bmi: 35, sbp: 140 },
    { bmi: 37, sbp: 148 },
];

// Radar: vitals profile
const radarData = [
    { metric: 'BP',     current: 62, target: 90 },
    { metric: 'HR',     current: 75, target: 80 },
    { metric: 'O₂ Sat', current: 77, target: 100 },
    { metric: 'Temp',   current: 70, target: 75 },
    { metric: 'RR',     current: 50, target: 65 },
];

// Composed: admissions + avg length-of-stay
const composedData = [
    { month: 'Jan', admissions: 152, avgLOS: 14.1 },
    { month: 'Feb', admissions: 133, avgLOS: 10.8 },
    { month: 'Mar', admissions: 186, avgLOS: 18.5 },
    { month: 'Apr', admissions: 162, avgLOS: 14.2 },
    { month: 'May', admissions: 198, avgLOS: 54.8 },
    { month: 'Jun', admissions: 178, avgLOS: 34.3 },
];

// Treemap: diagnosis burden by category
const treemapData = [
    { name: 'Cardiovascular', size: 840 },
    { name: 'Metabolic',      size: 620 },
    { name: 'Respiratory',    size: 480 },
    { name: 'Neurological',   size: 310 },
    { name: 'Oncology',       size: 290 },
    { name: 'Musculoskeletal', size: 210 },
    { name: 'Infectious',     size: 175 },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export function ChartPage() {
    return (
        <section className="mt-4 max-w-4xl">
            <ClinicalPageHeader title="Chart" />
            <p className="cp-text-txt-4 mb-6">
                A generic chart component wrapping{' '}
                <a href="https://recharts.org" target="_blank" rel="noreferrer">Recharts</a>.
                Supports <code>line</code>, <code>area</code>, <code>column</code> (vertical bars),{' '}
                <code>bar</code> (horizontal bars), and <code>pie</code> chart types. Multi-series
                data can be supplied as pre-structured column data or as a flat array with a{' '}
                <code>stratifyBy</code> prop that automatically pivots the data into series.
            </p>

            <hr className="mb-6 cp-border-win-3 cp-border-solid" />

            {/* Props */}
            <h3 className="mb-3">Props</h3>
            <table className="mb-8 text-sm w-full">
                <thead>
                    <tr className="cp-text-txt-4 text-left">
                        <th className="pb-2 pr-6">Prop</th>
                        <th className="pb-2 pr-6">Type</th>
                        <th className="pb-2 pr-6">Default</th>
                        <th className="pb-2">Description</th>
                    </tr>
                </thead>
                <tbody className="align-top">
                    {[
                        ['type', "'line' | 'area' | 'bar' | 'column' | 'scatter' | 'pie' | 'radar' | 'radialBar' | 'funnel' | 'treemap' | 'composed'", '—', 'Chart variant to render. Required.'],
                        ['data', 'ChartDataRecord[]', '—', 'Array of data objects for XY charts.'],
                        ['xKey', 'string', '—', 'Field name used as the x-axis / category.'],
                        ['yKey', 'string', '—', 'Shorthand y-axis field for single-series charts.'],
                        ['series', 'SeriesDef[]', '—', 'Explicit series definitions (key, name, color) for multi-series charts.'],
                        ['stratifyBy', 'string', '—', 'Group flat data by this field; one series per unique value. Requires xKey and yKey.'],
                        ['slices', 'PieSlice[]', '—', 'Named slices for pie, radialBar, funnel. Falls back to data + xKey/yKey.'],
                        ['height', 'number', '300', 'Chart height in pixels.'],
                        ['colors', 'string[]', 'library palette', 'Override the default color palette.'],
                        ['showLegend', 'boolean', 'true', 'Show the legend (only when > 1 series for XY charts).'],
                        ['showGrid', 'boolean', 'true', 'Show cartesian grid lines.'],
                        ['xLabel', 'string', '—', 'Optional x-axis label.'],
                        ['yLabel', 'string', '—', 'Optional y-axis label.'],
                        ['series[].chartType', "'line'|'area'|'bar'", "'line'", "For composed charts: how to render each series."],
                        ['series[].data', 'ChartDataRecord[]', '—', 'Per-series data points, used for scatter when each series has independent records.'],
                    ].map(([prop, type, def, desc]) => (
                        <tr key={prop}>
                            <td className="pr-6 py-1"><code>{prop}</code></td>
                            <td className="pr-6 py-1"><code>{type}</code></td>
                            <td className="pr-6 py-1">{def}</td>
                            <td className="py-1">{desc}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <hr className="mb-6 cp-border-win-3 cp-border-solid" />

            {/* Line chart */}
            <h3 className="mb-2">Line — multi-series</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Pre-structured multi-series data. Each object in <code>data</code> has one field per
                series; <code>series</code> declares which fields to plot.
            </p>
            <div className="mb-4">
                <Chart
                    type="line"
                    data={vitalsOverTime}
                    xKey="time"
                    series={[
                        { key: 'systolic',  name: 'Systolic'  },
                        { key: 'diastolic', name: 'Diastolic' },
                    ]}
                    // xLabel="Time"
                    yLabel="mmHg"
                    height={260}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="line"
    data={vitalsOverTime}
    xKey="time"
    series={[
        { key: 'systolic',  name: 'Systolic'  },
        { key: 'diastolic', name: 'Diastolic' },
    ]}
    // xLabel="Time"
    yLabel="mmHg"
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Area chart */}
            <h3 className="mb-2">Area — stratifier</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Flat data pivoted automatically. Each record has one x-value, one y-value, and a
                stratifier field. The component groups records by <code>dept</code> and creates one
                area series per unique value.
            </p>
            <div className="mb-4">
                <Chart
                    type="area"
                    data={flatAdmissions}
                    xKey="month"
                    yKey="count"
                    stratifyBy="dept"
                    height={260}
                />
            </div>
            <CodeBlock language="tsx">{`// data = [{ month: 'Jan', dept: 'ICU', count: 42 }, ...]
<Chart
    type="area"
    data={flatAdmissions}
    xKey="month"
    yKey="count"
    stratifyBy="dept"
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Column chart */}
            <h3 className="mb-2">Column — multi-series</h3>
            <div className="mb-4">
                <Chart
                    type="column"
                    data={monthlyAdmissions}
                    xKey="month"
                    series={[
                        { key: 'ICU'  },
                        { key: 'ED'   },
                        { key: 'Ward' },
                    ]}
                    yLabel="Admissions"
                    height={260}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="column"
    data={monthlyAdmissions}
    xKey="month"
    series={[{ key: 'ICU' }, { key: 'ED' }, { key: 'Ward' }]}
    yLabel="Admissions"
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Horizontal bar chart */}
            <h3 className="mb-2">Bar (horizontal)</h3>
            <div className="mb-4">
                <Chart
                    type="bar"
                    data={diagnosisCounts}
                    xKey="dx"
                    yKey="n"
                    showLegend={false}
                    height={260}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="bar"
    data={diagnosisCounts}
    xKey="dx"
    yKey="n"
    showLegend={false}
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Pie chart */}
            <h3 className="mb-2">Pie</h3>
            <div className="mb-4 max-w-sm">
                <Chart
                    type="pie"
                    slices={[
                        { name: 'Hypertension',  value: 320 },
                        { name: 'Diabetes T2',   value: 245 },
                        { name: 'COPD',          value: 188 },
                        { name: 'Heart Failure', value: 154 },
                        { name: 'Asthma',        value: 132 },
                    ]}
                    height={280}                    
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="pie"
    slices={[
        { name: 'Hypertension',  value: 320 },
        { name: 'Diabetes T2',   value: 245 },
        { name: 'COPD',          value: 188 },
        { name: 'Heart Failure', value: 154 },
        { name: 'Asthma',        value: 132 },
    ]}
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Scatter chart */}
            <h3 className="mb-2">Scatter</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Each series carries its own <code>data</code> array of <code>{'{ x, y }'}</code> records.
                Use <code>stratifyBy</code> to split a flat dataset automatically.
            </p>
            <div className="mb-4">
                <Chart
                    type="scatter"
                    xKey="bmi"
                    yKey="sbp"
                    series={[
                        { key: 'cohortA', name: 'Cohort A', data: scatterCohortA },
                        { key: 'cohortB', name: 'Cohort B', data: scatterCohortB },
                    ]}
                    xLabel="BMI"
                    yLabel="Systolic BP"
                    height={260}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="scatter"
    xKey="bmi"
    yKey="sbp"
    series={[
        { key: 'cohortA', name: 'Cohort A', data: cohortAData },
        { key: 'cohortB', name: 'Cohort B', data: cohortBData },
    ]}
    xLabel="BMI"
    yLabel="Systolic BP"
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Radar chart */}
            <h3 className="mb-2">Radar</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Spider / web chart. <code>xKey</code> names the category axis;
                each <code>series</code> key is a numeric field per category.
            </p>
            <div className="mb-4 max-w-sm">
                <Chart
                    type="radar"
                    data={radarData}
                    xKey="metric"
                    series={[
                        { key: 'current', name: 'Current' },
                        { key: 'target',  name: 'Target'  },
                    ]}
                    height={280}
                    colors={['#33FC', '#090C']}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="radar"
    data={radarData}
    xKey="metric"
    series={[
        { key: 'current', name: 'Current' },
        { key: 'target',  name: 'Target'  },
    ]}
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* RadialBar chart */}
            <h3 className="mb-2">RadialBar</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Circular progress bars, one per slice. Accepts <code>slices</code> or
                flat <code>data</code> + <code>xKey</code> / <code>yKey</code>.
            </p>
            <div className="mb-4 max-w-sm">
                <Chart
                    type="radialBar"
                    slices={[
                        { name: 'Hypertension',  value: 88 },
                        { name: 'Diabetes',      value: 72 },
                        { name: 'COPD',          value: 61 },
                        { name: 'Heart Failure', value: 54 },
                    ]}
                    height={280}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="radialBar"
    slices={[
        { name: 'Hypertension',  value: 88 },
        { name: 'Diabetes',      value: 72 },
        { name: 'COPD',          value: 61 },
        { name: 'Heart Failure', value: 54 },
    ]}
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Funnel chart */}
            <h3 className="mb-2">Funnel</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Visualize drop-off through sequential stages such as care pathways.
            </p>
            <div className="mb-4 max-w-sm">
                <Chart
                    type="funnel"
                    slices={[
                        { name: 'Referral',     value: 1200, color: '#6C96' },
                        { name: 'Consult',      value: 860, color: '#69C6' },
                        { name: 'Diagnosed',    value: 620, color: '#9396' },
                        { name: 'Treatment',    value: 480, color: '#9336' },
                        { name: 'Discharged',   value: 390, color: '#C606' },
                    ]}
                    height={280}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="funnel"
    slices={[
        { name: 'Referral',   value: 1200, color: '#6C96' },
        { name: 'Consult',    value: 860, color: '#69C6' },
        { name: 'Diagnosed',  value: 620, color: '#9396' },
        { name: 'Treatment',  value: 480, color: '#8336' },
        { name: 'Discharged', value: 390, color: '#6006' },
    ]}
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Treemap */}
            <h3 className="mb-2">Treemap</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Area-proportional tiles. Supply <code>data</code> with <code>name</code> (via <code>xKey</code>)
                and a numeric size field (via <code>yKey</code>, default <code>"size"</code>).
                Nodes may be nested by including a <code>children</code> array.
            </p>
            <div className="mb-4">
                <Chart
                    type="treemap"
                    data={treemapData}
                    xKey="name"
                    yKey="size"
                    height={260}
                    showLegend={false}
                    colors={[
                        '#FAA6', '#FB86', '#FD86', '#DD66', '#DAF6', '#9CC6', '#8DF6',
                    ]}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="treemap"
    data={[
        { name: 'Cardiovascular', size: 840 },
        { name: 'Metabolic',      size: 620 },
        { name: 'Respiratory',    size: 480 },
        // ...
    ]}
    xKey="name"
    yKey="size"
/>`}</CodeBlock>

            <hr className="my-6 cp-border-win-3 cp-border-solid" />

            {/* Composed chart */}
            <h3 className="mb-2">Composed</h3>
            <p className="cp-text-txt-4 mb-4 text-sm">
                Mix line, area, and bar series on the same axes. Set <code>series[].chartType</code> per series;
                omitted series default to <code>'line'</code>.
            </p>
            <div className="mb-4">
                <Chart
                    type="composed"
                    data={composedData}
                    xKey="month"
                    series={[
                        { key: 'admissions', name: 'Admissions', chartType: 'bar', color: '#F939' },
                        { key: 'avgLOS',     name: 'Avg LOS',    chartType: 'line', color: 'var(--cp-color-blue)' },
                    ]}
                    height={260}
                />
            </div>
            <CodeBlock language="tsx">{`<Chart
    type="composed"
    data={composedData}
    xKey="month"
    series={[
        { key: 'admissions', name: 'Admissions', chartType: 'bar', color: '#F939'  },
        { key: 'avgLOS',     name: 'Avg LOS',    chartType: 'line', color: 'var(--cp-color-blue)' },
    ]}
/>`}</CodeBlock>
        </section>
    );
}
