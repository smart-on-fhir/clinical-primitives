import {
    AreaChart, Area,
    BarChart, Bar,
    LineChart, Line,
    PieChart, Pie,
    ScatterChart, Scatter,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar,
    FunnelChart, Funnel,
    ComposedChart,
    Treemap,
    XAxis, YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Label,
    LabelList,
} from 'recharts';
import './Chart.scss';
import type { ChartProps, ChartDataRecord, SeriesDef } from './types';

// ---------------------------------------------------------------------------
// Default palette — semantic CSS variables, correct in light + dark themes.
// ---------------------------------------------------------------------------
const DEFAULT_COLORS = [
    'var(--cp-color-blue)',
    'var(--cp-color-purple)',
    'var(--cp-color-green)',
    'var(--cp-color-amber)',
    'var(--cp-color-teal)',
    'var(--cp-color-red)',
    'var(--cp-color-gray)',
    'var(--cp-color-yellow)',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pivot flat data into one column per group (line / area / column / bar / radar / composed). */
function pivotByStratifier(
    data: ChartDataRecord[],
    xKey: string,
    yKey: string,
    stratifyBy: string,
): { pivotedData: ChartDataRecord[]; derivedSeries: SeriesDef[] } {
    const xValues: (string | number)[] = [];
    const groups: string[] = [];

    for (const row of data) {
        const x = row[xKey];
        if (x != null && !xValues.includes(x as string | number)) {
            xValues.push(x as string | number);
        }
        const g = row[stratifyBy];
        if (g != null) {
            const gs = String(g);
            if (!groups.includes(gs)) groups.push(gs);
        }
    }

    const pivotedData = xValues.map(x => {
        const out: ChartDataRecord = { [xKey]: x };
        for (const group of groups) {
            const match = data.find(d => d[xKey] === x && String(d[stratifyBy]) === group);
            out[group] = match != null ? (match[yKey] ?? null) : null;
        }
        return out;
    });

    return {
        pivotedData,
        derivedSeries: groups.map(g => ({ key: g, name: g })),
    };
}

/** Split flat data into per-series arrays (scatter with stratifyBy). */
function splitByStratifier(
    data: ChartDataRecord[],
    stratifyBy: string,
): SeriesDef[] {
    const groups = new Map<string, ChartDataRecord[]>();
    for (const row of data) {
        const g = String(row[stratifyBy] ?? '');
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(row);
    }
    return Array.from(groups.entries()).map(([name, groupData]) => ({
        key: name, name, data: groupData,
    }));
}

/**
 * Embed a `fill` property into each item so Pie / RadialBar / Funnel pick up
 * per-item colors without using the deprecated Cell component.
 */
function withFill<T extends Record<string, unknown>>(
    items: T[],
    getColor: (i: number) => string,
): (T & { fill: string })[] {
    return items.map((item, i) => ({ ...item, fill: (item.color as string | undefined) ?? getColor(i) }));
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------
export function Chart({
    type,
    data,
    xKey,
    yKey,
    series,
    stratifyBy,
    slices,
    height = 300,
    colors,
    showLegend = true,
    showGrid = true,
    xLabel,
    yLabel,
    className = '',
}: ChartProps) {
    const palette  = colors?.length ? colors : DEFAULT_COLORS;
    const getColor = (i: number) => palette[i % palette.length];

    const xAxisLabel = xLabel
        ? <Label value={xLabel} offset={-4} position="insideBottom" />
        : undefined;
    const yAxisLabel = yLabel
        ? <Label value={yLabel} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
        : undefined;

    // ── Resolve series + data for XY chart types ─────────────────────────
    let chartData: ChartDataRecord[] = data ?? [];
    let resolvedSeries: SeriesDef[]  = series ?? [];

    // Guard: detect empty or all-null data before wasting a render
    const isPolarGuard = ['pie', 'radialBar', 'funnel', 'treemap'].includes(type);
    const hasSlices    = slices && slices.length > 0;
    const hasData      = chartData.length > 0;
    const hasNamedData = isPolarGuard && (hasSlices || hasData);

    if (!isPolarGuard && !hasData) {
        return (
            <div className={`cp-chart ${className} d-flex align-items-center justify-content-center text-muted`.trim()}
                 style={{ height, border: '1px dashed var(--bs-border-color)', borderRadius: 6 }}>
                No chart data available
            </div>
        );
    }
    if (isPolarGuard && !hasNamedData) {
        return (
            <div className={`cp-chart ${className} d-flex align-items-center justify-content-center text-muted`.trim()}
                 style={{ height, border: '1px dashed var(--bs-border-color)', borderRadius: 6 }}>
                No chart data available
            </div>
        );
    }

    const isPolar    = ['pie', 'radialBar', 'funnel', 'treemap'].includes(type);
    const isScatter  = type === 'scatter';

    if (!isPolar && !isScatter && stratifyBy && xKey && yKey) {
        const { pivotedData, derivedSeries } = pivotByStratifier(chartData, xKey, yKey, stratifyBy);
        chartData      = pivotedData;
        resolvedSeries = derivedSeries;
    } else if (isScatter && stratifyBy) {
        resolvedSeries = splitByStratifier(chartData, stratifyBy);
    } else if (!isPolar && resolvedSeries.length === 0 && yKey) {
        resolvedSeries = [{ key: yKey }];
    }

    // ── Shared cartesian margin ───────────────────────────────────────────
    const cartesianMargin = {
        top: 8, right: 16,
        bottom: xLabel ? 28 : 8,
        left:   yLabel ? 20 : 0,
    };

    // ── Shared axis elements ──────────────────────────────────────────────
    const XA = (
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }}>
            {xAxisLabel}
        </XAxis>
    );
    const YA = (
        <YAxis tick={{ fontSize: 11 }} width={48}>
            {yAxisLabel}
        </YAxis>
    );
    const CG = showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null;
    const TT = <Tooltip />;
    const TTSoftCursor = <Tooltip cursor={{ fill: 'rgba(127,127,127,0.08)' }} />;
    const LEG = (count: number) => showLegend && count > 1 ? <Legend /> : null;

    // ── Series → Recharts elements ───────────────────────────────────────
    const Lines = () => resolvedSeries.map((s, i) => (
        <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
              stroke={s.color ?? getColor(i)} strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} />
    ));

    const Areas = () => resolvedSeries.map((s, i) => (
        <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
              stroke={s.color ?? getColor(i)} fill={s.color ?? getColor(i)}
              strokeWidth={2} fillOpacity={0.15} />
    ));

    const renderBars = (radius: [number, number, number, number] = [2, 2, 0, 0]) =>
        resolvedSeries.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key}
                 fill={s.color ?? getColor(i)} radius={radius} />
        ));

    const ComposedSeries = () => resolvedSeries.map((s, i) => {
        const ct = s.chartType ?? 'line';
        if (ct === 'bar')
            return <Bar  key={s.key} dataKey={s.key} name={s.name ?? s.key}
                         fill={s.color ?? getColor(i)} radius={[2, 2, 0, 0]} />;
        if (ct === 'area')
            return <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
                         stroke={s.color ?? getColor(i)} fill={s.color ?? getColor(i)} fillOpacity={0.15} />;
        return <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
                     stroke={s.color ?? getColor(i)} strokeWidth={2}
                     dot={false} activeDot={{ r: 4 }} />;
    });

    // ── Named-item data (Pie / RadialBar / Funnel) ───────────────────────
    const namedData = () => {
        const raw = slices
            ?? (data && xKey && yKey
                ? data.map(d => ({ name: String(d[xKey] ?? ''), value: Number(d[yKey] ?? 0) }))
                : []);
        return withFill(raw, getColor);
    };

    // ── Render ────────────────────────────────────────────────────────────
    let chart: React.ReactNode;

    if (type === 'line') {
        chart = (
            <LineChart data={chartData} margin={cartesianMargin}>
                {CG}{XA}{YA}{TT}{LEG(resolvedSeries.length)}
                <Lines />
            </LineChart>
        );

    } else if (type === 'area') {
        chart = (
            <AreaChart data={chartData} margin={cartesianMargin}>
                {CG}{XA}{YA}{TT}{LEG(resolvedSeries.length)}
                <Areas />
            </AreaChart>
        );

    } else if (type === 'column') {
        chart = (
            <BarChart data={chartData} margin={cartesianMargin}>
                {showGrid ? <CartesianGrid strokeDasharray="3 3" vertical={false} /> : null}
                {XA}{YA}{TTSoftCursor}{LEG(resolvedSeries.length)}
                {renderBars()}
            </BarChart>
        );

    } else if (type === 'bar') {
        chart = (
            <BarChart data={chartData} layout="vertical" margin={cartesianMargin}>
                {showGrid ? <CartesianGrid strokeDasharray="3 3" horizontal={false} /> : null}
                <XAxis type="number" tick={{ fontSize: 11 }}>
                    {xAxisLabel}
                </XAxis>
                <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11 }} width={80}>
                    {yAxisLabel}
                </YAxis>
                {TTSoftCursor}{LEG(resolvedSeries.length)}
                {renderBars([0, 2, 2, 0])}
            </BarChart>
        );

    } else if (type === 'scatter') {
        const scatterSeries = resolvedSeries.length > 0
            ? resolvedSeries
            : [{ key: 'default', name: '', data: chartData }];

        chart = (
            <ScatterChart margin={cartesianMargin}>
                {showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
                <XAxis type="number" dataKey={xKey ?? 'x'}
                       name={xLabel ?? xKey ?? 'x'} tick={{ fontSize: 11 }}>
                    {xAxisLabel}
                </XAxis>
                <YAxis type="number" dataKey={yKey ?? 'y'}
                       name={yLabel ?? yKey ?? 'y'} tick={{ fontSize: 11 }} width={48}>
                    {yAxisLabel}
                </YAxis>
                {TT}{LEG(scatterSeries.length)}
                {scatterSeries.map((s, i) => (
                    <Scatter key={s.key}
                             name={s.name ?? s.key}
                             data={(s.data ?? chartData) as object[]}
                             fill={s.color ?? getColor(i)} />
                ))}
            </ScatterChart>
        );

    } else if (type === 'pie') {
        const pieData = namedData();
        chart = (
            <PieChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <Pie data={pieData} dataKey="value" nameKey="name"
                     cx="50%" cy="50%" outerRadius="80%"
                     paddingAngle={0}
                     stroke="var(--cp-color-win)"
                     strokeWidth={2} />
                {TT}
                {showLegend ? <Legend /> : null}
            </PieChart>
        );

    } else if (type === 'radar') {
        chart = (
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%"
                        margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <PolarGrid />
                <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                {TT}{LEG(resolvedSeries.length)}
                {resolvedSeries.map((s, i) => (
                    <Radar key={s.key} name={s.name ?? s.key} dataKey={s.key}
                           stroke={s.color ?? getColor(i)}
                           fill={s.color ?? getColor(i)}
                           fillOpacity={0.2} />
                ))}
            </RadarChart>
        );

    } else if (type === 'radialBar') {
        const rbData = namedData();
        const maxVal = Math.max(...rbData.map(d => (d as unknown as { value: number }).value), 1);
        const hasLegend = showLegend && rbData.length > 0;
        chart = (
            <RadialBarChart data={rbData}
                            cx={hasLegend ? '35%' : '50%'}
                            cy="50%"
                            innerRadius="20%"
                            outerRadius={hasLegend ? '100%' : '90%'}
                            margin={{ top: 4, right: hasLegend ? 50 : 16, bottom: 4, left: 4 }}>
                <PolarAngleAxis type="number" domain={[0, maxVal * 1.1]} tick={false} />
                <RadialBar dataKey="value" background />
                {TT}
                {hasLegend
                    ? <Legend
                        iconSize={10}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ right: 8 }}
                    />
                    : null}
            </RadialBarChart>
        );

    } else if (type === 'funnel') {
        const funnelData = namedData();
        chart = (
            <FunnelChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                {TT}
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList dataKey="name" position="inside"
                               fill="var(--cp-color-txt)" fontSize={11} />
                </Funnel>
            </FunnelChart>
        );

    } else if (type === 'treemap') {
        const treemapData = (data ?? []).map((item, i) => ({
            ...item,
            fill: (item as ChartDataRecord & { fill?: string; color?: string }).fill
                ?? (item as ChartDataRecord & { color?: string }).color
                ?? getColor(i),
        }));
        chart = (
            <Treemap data={treemapData}
                     dataKey={yKey ?? 'size'}
                     nameKey={xKey ?? 'name'}
                     aspectRatio={4 / 3}
                     fill="transparent"
                     content={(nodeProps: {
                         x?: number;
                         y?: number;
                         width?: number;
                         height?: number;
                         depth?: number;
                         index?: number;
                         name?: string;
                         fill?: string;
                         payload?: Record<string, unknown>;
                     }) => {
                         const { x = 0, y = 0, width = 0, height = 0, depth = 0, index = 0, name, payload, fill } = nodeProps;
                         if (width <= 0 || height <= 0) return <g />;

                         // Prefer the node's computed fill, then payload fields, then palette fallback.
                         const nodeFill = fill
                             ?? (payload?.fill as string | undefined)
                             ?? (payload?.color as string | undefined)
                             ?? getColor(index);

                         return (
                             <g>
                                 <rect
                                     x={x}
                                     y={y}
                                     width={width}
                                     height={height}
                                     fill={nodeFill}
                                     stroke="var(--cp-color-win)"
                                     strokeWidth={1}
                                     rx={2}
                                     ry={2}
                                 />
                                 {depth > 0 && width > 56 && height > 20 ? (
                                     <text
                                         x={x + 6}
                                         y={y + 16}
                                         fontSize={11}
                                         fill="var(--cp-color-txt)"
                                     >
                                         {name}
                                     </text>
                                 ) : null}
                             </g>
                         );
                     }}>
                {TT}
            </Treemap>
        );

    } else {
        // composed
        chart = (
            <ComposedChart data={chartData} margin={cartesianMargin}>
                {CG}{XA}{YA}{TTSoftCursor}{LEG(resolvedSeries.length)}
                <ComposedSeries />
            </ComposedChart>
        );
    }

    return (
        <div className={`cp-chart ${className}`.trim()}>
            <ResponsiveContainer width="100%" height={height}>
                {chart as React.ReactElement}
            </ResponsiveContainer>
        </div>
    );
}
