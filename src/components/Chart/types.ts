export type ChartType =
    | 'line'
    | 'area'
    | 'bar'         // horizontal bars
    | 'column'      // vertical bars
    | 'scatter'
    | 'pie'
    | 'radar'
    | 'radialBar'
    | 'funnel'
    | 'treemap'
    | 'composed';

export type SeriesDef = {
    /** Data key in each record. */
    key: string;
    /** Display name shown in legend/tooltip. Defaults to `key`. */
    name?: string;
    /** CSS color for this series. */
    color?: string;
    /**
     * Per-series data points. Used for `scatter` charts where each series
     * has its own independent set of {x, y} records.
     */
    data?: ChartDataRecord[];
    /**
     * For `composed` charts: how to render this series.
     * Defaults to `'line'`.
     */
    chartType?: 'line' | 'area' | 'bar';
};

export type PieSlice = {
    name: string;
    value: number;
    color?: string;
};

export type ChartDataRecord = Record<string, string | number | null | undefined>;

export type ChartProps = {
    /** The chart variant to render. */
    type: ChartType;

    // ── XY chart data ──────────────────────────────────────────────────────
    /**
     * Array of data objects. For pre-built multi-series charts each object
     * has one field per series keyed by the corresponding `SeriesDef.key`.
     * When `stratifyBy` is supplied the records are flat (one per x/group pair)
     * and the component pivots them automatically.
     */
    data?: ChartDataRecord[];

    /** Field name to use as the x-axis category. Required for XY charts. */
    xKey?: string;

    /** Shorthand y-axis field name for single-series XY charts. */
    yKey?: string;

    /**
     * Explicit series definitions. Use this for multi-series charts where the
     * data already contains one column per series.
     */
    series?: SeriesDef[];

    /**
     * When set, the component groups `data` by this field and creates one
     * series per unique value.
     *
     * - For XY chart types (`line`, `area`, `column`, `bar`, `radar`,
     *   `composed`): data is pivoted so each group becomes a column.
     *   Requires `xKey` and `yKey`.
     * - For `scatter`: data is split into per-series arrays.
     *   Requires `xKey` and `yKey`.
     *
     * @example
     * // data = [{ date: 'Jan', value: 10, dept: 'ICU' }, ...]
     * <Chart type="line" data={data} xKey="date" yKey="value" stratifyBy="dept" />
     */
    stratifyBy?: string;

    // ── Pie / radialBar / funnel data ─────────────────────────────────────
    /**
     * Named slices for `pie`, `radialBar`, and `funnel` charts.
     * When omitted the component derives slices from `data` + `xKey`/`yKey`.
     */
    slices?: PieSlice[];

    // ── Display ────────────────────────────────────────────────────────────
    /** Chart height in pixels. Default: 300. */
    height?: number;

    /** Override the default color palette. */
    colors?: string[];

    /** Show the legend. Default: true. */
    showLegend?: boolean;

    /** Show the cartesian grid lines. Default: true. */
    showGrid?: boolean;

    /** Optional x-axis label rendered below the axis. */
    xLabel?: string;

    /** Optional y-axis label rendered to the left of the axis. */
    yLabel?: string;

    /** Additional CSS class name applied to the root element. */
    className?: string;
};
