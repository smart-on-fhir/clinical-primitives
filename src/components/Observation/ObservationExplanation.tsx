import { Observation } from "fhir/r4";
import { DeltaResult, getObservationDate, getObservationValue, SPARKLINE_MAX_POINTS, VitalStatus } from "./utils";
import { SparklineSeries } from "../Sparkline/utils";
import "./ObservationExplanation.scss";


// ObservationExplanation
function ExpSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="cp-obs-exp-section">
            <div className="cp-obs-exp-label">{title}</div>
            {children}
        </div>
    );
}

export function ObservationExplanation({
    observation,
    name,
    value,
    unit,
    date,
    status,
    delta,
    series,
    isSinglePoint,
    isNonNumeric,
    isManyComponents,
    observations,
    totalReadings,
}: {
    observation: Observation;
    name: string;
    value: string;
    unit: string | null;
    date: Date | null;
    status: VitalStatus | null;
    delta: DeltaResult | null;
    series: SparklineSeries[];
    isSinglePoint: boolean;
    isNonNumeric: boolean;
    isManyComponents: boolean;
    observations: Observation[];   // windowed set used for sparkline
    totalReadings: number;         // full history count
}) {
    const dateStr = date
        ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : null;

    // --- Status source ---
    const interpretations = [
        ...(observation.interpretation ?? []),
        ...((observation.component ?? []).flatMap(c => c.interpretation ?? [])),
    ];
    const hasInterpretationCodes = interpretations.some(i => (i.coding ?? []).length > 0);

    const primaryRef = observation.referenceRange?.[0];
    const refLo = primaryRef?.low?.value;
    const refHi = primaryRef?.high?.value;
    const refUnit = primaryRef?.low?.unit || primaryRef?.high?.unit || unit || '';
    const hasRefRange = refLo !== undefined || refHi !== undefined;

    const refRangeStr = hasRefRange
        ? (refLo !== undefined && refHi !== undefined
            ? `${refLo}–${refHi}${refUnit ? ' ' + refUnit : ''}`
            : refLo !== undefined
                ? `≥ ${refLo}${refUnit ? ' ' + refUnit : ''}`
                : `≤ ${refHi}${refUnit ? ' ' + refUnit : ''}`)
        : null;

    // --- Previous reading for delta context ---
    const prevObs = [...observations]
        .sort((a, b) =>
            new Date(b.effectiveDateTime || b.issued || '').getTime() -
            new Date(a.effectiveDateTime || a.issued || '').getTime()
        )
        .find(o => o !== observation);
    const prevValue = prevObs ? getObservationValue(prevObs) : null;
    const prevDate  = prevObs ? getObservationDate(prevObs) : null;

    const statusLabel: Record<VitalStatus, string> = {
        ok:       'normal',
        warn:     'borderline',
        abnormal: 'abnormal',
    };
    const statusColor: Record<VitalStatus, string> = {
        ok:       'green',
        warn:     'amber',
        abnormal: 'red',
    };

    return (
        <div className="cp-obs-history-body cp-obs-explanation">

            <ExpSection title="What this is">
                <p>
                    <strong>{name}</strong> is a clinical measurement recorded in the patient record.
                    The most recent reading is <strong>{value}{unit ? '\u00a0' + unit : ''}</strong>
                    {dateStr ? `, recorded on ${dateStr}` : ''}.
                    {totalReadings > 1 && ` There are ${totalReadings} readings in total.`}
                </p>
            </ExpSection>

            <ExpSection title="Trend">
                {isSinglePoint ? (
                    <p>Only one reading is available, so no trend can be shown.</p>
                ) : isNonNumeric ? (
                    <p>
                        This is a coded or text value rather than a number, so no numeric
                        trend line is drawn. The full history of recorded values is available
                        in the Data tab.
                    </p>
                ) : isManyComponents ? (
                    <p>
                        This observation has {series.length} numeric components, which is too
                        many to render clearly as sparklines. The full history of all components
                        is available in the Data tab.
                    </p>
                ) : series.length > 1 ? (
                    <p>
                        The sparkline shows up to {SPARKLINE_MAX_POINTS} readings centered
                        around the current value, with earlier readings on the left and later
                        ones on the right. Two series are plotted
                        ({series.map(s => s.label).filter(Boolean).join(' and ')}), sharing the
                        same vertical scale so the lines are directly comparable. The highlighted
                        dot marks the current reading.
                    </p>
                ) : (
                    <p>
                        The sparkline shows up to {SPARKLINE_MAX_POINTS} readings centered
                        around the current value ({observations.length} in the current window),
                        with earlier readings on the left and later ones on the right.
                        The highlighted dot marks the current reading.
                    </p>
                )}
            </ExpSection>

            <ExpSection title="Change">
                {isSinglePoint ? (
                    <p>No prior reading is available, so no change can be calculated.</p>
                ) : !delta ? (
                    <p>
                        No numeric change could be calculated. This may be a coded or text
                        value, or the two most recent readings are identical.
                    </p>
                ) : (
                    <p>
                        Compared to the
                        {prevDate
                            ? ` ${prevDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                            : ' previous'} reading
                        {prevValue ? ` of ${prevValue.value}${prevValue.unit ? '\u00a0' + prevValue.unit : ''}` : ''},
                        the value has <strong>
                            {delta.direction === 'flat'
                                ? 'stayed stable'
                                : delta.direction === 'improving'
                                    ? 'improved'
                                    : 'worsened'}
                        </strong> ({delta.text}).
                        {delta.direction !== 'flat' && hasRefRange && (
                            <> The direction is assessed relative to the reference range.</>
                        )}
                    </p>
                )}
            </ExpSection>

            <ExpSection title="Status">
                {!status ? (
                    <p>
                        No status or reference range is available for this observation,
                        so no color coding has been applied.
                    </p>
                ) : (
                    <>
                        <p>
                            The <strong>{statusLabel[status]}</strong> status is shown with
                            a {statusColor[status]} background.
                            {hasInterpretationCodes && (
                                <> The status was provided directly by the reporting system
                                as an interpretation code.</>
                            )}
                            {!hasInterpretationCodes && hasRefRange && (
                                <> The status was derived by comparing the value
                                against the reference range ({refRangeStr}).</>
                            )}
                        </p>
                        {hasRefRange && (
                            <p className="cp-obs-exp-ref">
                                Reference range: <strong>{refRangeStr}</strong>
                            </p>
                        )}
                    </>
                )}
            </ExpSection>

        </div>
    );
}
// .cp-obs-history-body.cp-obs-explanation
    // .cp-obs-exp-ref
    // .cp-obs-exp-section
        // .cp-obs-exp-label
