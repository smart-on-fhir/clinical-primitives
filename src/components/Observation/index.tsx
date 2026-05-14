import { CSSProperties, useState }    from "react";
import { Observation }                from "fhir/r4";
import { InfoIcon }                   from "lucide-react";
import { ObservationExplanation }     from "./ObservationExplanation";
import { ObservationHistoryTable }    from "./ObservationHistoryTable";
import { computeMultiSparklines }     from "../Sparkline/utils";
import { SourceDialog }               from "../Dialog/SourceDialog";
import { Sparkline, useClinicalData } from "../../index";
import { ellipsis }                   from "../../utils";
import {
    computeDelta,
    getObservationDate,
    getObservationDisplayName,
    getObservationStatus,
    getObservationValue,
    SPARKLINE_MAX_POINTS,
} from "./utils";
import "./ObservationCard.scss";


/**
 * Given a single FHIR Observation, renders a card with the observation name,
 * units, value, and a sparkline of recent values for that observation.
 * Clicking the info icon opens a modal with the full reading history.
 */
export function ObservationCard({
    observation,
    history = [],
    style
}: {
    /**
     * The FHIR Observation to display in the card.
     */
    observation: Observation,

    /**
     * Optional list of recent observations of the same type for sparkline generation.
     */
    history?: Observation[],

    style?: CSSProperties;

}) {
    const [modalOpen, setModalOpen] = useState(false);

    const name            = getObservationDisplayName(observation);
    const status          = getObservationStatus(observation);
    const date            = getObservationDate(observation);
    const { value, unit } = getObservationValue(observation);

    // Build a centred window: up to half the budget before the current
    // observation and half after. If there is no data after (e.g. we are
    // viewing the most recent record), the full budget looks backwards.
    const half = Math.floor(SPARKLINE_MAX_POINTS / 2);
    const seen = new Set<string>();
    const allSameName = history.filter(obs => {
        const key = obs.id ?? `${getObservationDate(obs)?.getTime()}-${getObservationValue(obs).value}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return getObservationDisplayName(obs) === name;
    });
    const sortedAsc = [...allSameName].sort(
        (a, b) => (getObservationDate(a)?.getTime() ?? 0) - (getObservationDate(b)?.getTime() ?? 0)
    );
    const observations: Observation[] = (() => {
        if (!date) return sortedAsc.slice(-SPARKLINE_MAX_POINTS);
        const ct = date.getTime();
        const before = sortedAsc.filter(o => (getObservationDate(o)?.getTime() ?? 0) <= ct);
        const after  = sortedAsc.filter(o => (getObservationDate(o)?.getTime() ?? 0) > ct);
        const afterSlots  = Math.min(after.length,  half);
        const beforeSlots = Math.min(before.length, SPARKLINE_MAX_POINTS - afterSlots);
        return [...before.slice(-beforeSlots), ...after.slice(0, afterSlots)];
    })();

    const sparkColor = status === 'abnormal' ? 'var(--cp-color-red)' : status === 'warn' ? 'var(--cp-color-amber)' : 'var(--cp-color-green)';
    const series = computeMultiSparklines(observations, { sparkColor, observation, lineWidth: 1 });

    const isSinglePoint = observations.length <= 1;
    // No plottable data even though we have multiple readings (all coded-concept values).
    const isNonNumeric = !isSinglePoint && series.length === 0;
    // More than 2 components: too dense for sparklines, defer to the modal.
    const isManyComponents = series.length > 2;

    // For non-numeric with multiple distinct values, check if values differ so
    // we can show "unchanged" vs a hint that values varied (details in modal).
    const allSameValue = isNonNumeric && (() => {
        const vals = new Set(observations.map(o => getObservationValue(o).value).filter(Boolean));
        return vals.size <= 1;
    })();

    const delta = computeDelta(observations);
    const deltaClass = delta ? `delta-${delta.direction}` : '';
    const hasChart = !isSinglePoint && !isNonNumeric && !isManyComponents && series.length > 0;
    const isText = String(value).trim().includes(' '); // heuristic: likely a text value if it has multiple words and no unit

    return (
        <div className={`cp-observation-card${
            status           ? ` ${status}`       : ''}${
            hasChart         ? ' has-chart'       : ''}${
            isNonNumeric     ? ' non-numeric'     : ''}${
            isManyComponents ? ' many-components' : ''}${
            unit             ? ' has-unit'        : ''}${
            isText           ? ' is-text'         : ''}`}
            style={style}>
            <div
                className="info-btn"
                role="button"
                title="View details..."
                onClick={() => setModalOpen(true)}
            >
                <InfoIcon className="info-icon" />
            </div>
            <div className="cp-observation-column">
                <div className="vital-name">{name}</div>
                <div className="vital-value">
                    {ellipsis(value, 50)} <span className="vital-unit">{unit}</span>
                </div>

                {hasChart ? (
                    <Sparkline series={series} aspectRatio={4/1} />
                ) : isManyComponents ? (
                    <div className="vital-spark vital-spark-text">
                        <span className="spark-text-stable">{series.length} components</span>
                    </div>
                ) : isNonNumeric && allSameValue ? (
                    <div className="vital-spark vital-spark-text">
                        <span className="spark-text-stable">unchanged</span>
                    </div>
                ) : (
                    null//<div className="vital-spark" />
                )}

                <div className="vital-cell-footer">
                    {isSinglePoint
                        ? <div className="vital-delta delta-flat">first rec</div>
                        : isManyComponents
                            ? <div className="vital-delta delta-flat">{observations.length} readings</div>
                            : isNonNumeric
                                ? <div className="vital-delta delta-flat">{observations.length} readings</div>
                                : delta && <div className={`vital-delta ${deltaClass}`}>{delta.text}</div>
                    }
                    <div className="vital-date">{date ? date.toLocaleDateString(undefined, { year: '2-digit', month: '2-digit', day: '2-digit' }) : ''}</div>
                </div>
            </div>
            <SourceDialog
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                resource={observation}
                prependTabs={[
                    {
                        label: 'Explanation',
                        content: (
                            <ObservationExplanation
                                observation={observation}
                                name={name}
                                value={value}
                                unit={unit}
                                date={date}
                                status={status}
                                delta={delta}
                                series={series}
                                isSinglePoint={isSinglePoint}
                                isNonNumeric={isNonNumeric}
                                isManyComponents={isManyComponents}
                                observations={observations}
                                totalReadings={allSameName.length}
                            />
                        ),
                    },
                    {
                        label: 'History',
                        content: <ObservationHistoryTable history={allSameName} />,
                    }
                ]}
            />
        </div>
    );
}

export function ObservationCardWrapper({ observationId, style }: { observationId: string, style?: CSSProperties  }) {
    const { resources } = useClinicalData();    
    const observations  = resources?.Observation || [];
    const observation   = observations.find(o => o.id === observationId) as Observation | undefined;

    if (!observation) {
        return (
            <div className="rounded-lg p-4 bg-amber-500/50 border border-amber-500/50">
                Observation with ID {observationId} not found.
            </div>
        );
    }
    
    const name = getObservationDisplayName(observation)
    const history = (observations as unknown as Observation[])
        .filter(o => getObservationDisplayName(o as Observation) === name) as Observation[];
    return <ObservationCard observation={observation as Observation} history={history} style={style} />;
}