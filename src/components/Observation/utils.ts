import { Observation } from "fhir/r4";
import { roundToPrecision } from "../../utils";


export const SPARKLINE_MAX_POINTS = 16;


export function getObservationDisplayName(obs: Observation): string {
    const coding = obs.code?.coding || [];
    const raw = obs.code?.text || coding[0]?.display || 'Unknown Observation';
    return shortenObservationName(raw);
}

export function shortenObservationName(name: string): string {
    return name
        .replace(/\s*\[[^\]]*\]/g, '')       // strip [...] qualifiers
        .replace(/\s+by\s+\w[\w\s]*$/i, '')  // strip trailing "by <method>"
        .replace(/(\s+-\s+\w+)+$/i, (match) => {
            // strip trailing dash-segments that are reporter/method words
            // e.g. "- Reported", "- Observed", "- Automated" but keep "- 0-10" ranges
            const stripped = match.replace(/(\s+-\s+(?![0-9])\w+)+$/, '');
            return stripped;
        })
        .trim();
}

export type VitalStatus = 'ok' | 'warn' | 'abnormal';

/**
 * Derives display status from FHIR interpretation codes, then falls back to
 * comparing the numeric value against referenceRange low/high bounds.
 * For component-based observations (e.g. blood pressure) the worst status
 * across all components is returned.
 */
export function getObservationStatus(obs: Observation): VitalStatus | null {
    // --- 1. Interpretation codes (most authoritative) ---
    const interpretations = [
        ...(obs.interpretation ?? []),
        ...((obs.component ?? []).flatMap(c => c.interpretation ?? []))
    ];

    let worst: VitalStatus | null = null;

    const rank: Record<VitalStatus, number> = { ok: 0, warn: 1, abnormal: 2 };

    function upgrade(s: VitalStatus) {
        if (worst === null || rank[s] > rank[worst]) worst = s;
    }

    for (const interpretation of interpretations) {
        for (const coding of interpretation.coding ?? []) {
            const code = coding.code ?? '';
            if (['HH', 'LL', 'A', 'AA', 'CR', 'CT'].includes(code)) {
                upgrade('abnormal');
                break;
            }
            if (['H', 'L', 'HU', 'LU', 'H>', 'L<'].includes(code)) {
                upgrade('warn');
                break;
            }
            if (['N', 'NL', 'ND', 'EX', 'IND'].includes(code)) {
                upgrade('ok');
                break;
            }
        }
    }

    // If we have a definitive answer (abnormal or explicitly normal), stop here.
    // If worst is only 'warn' (or null), also run the reference-range check —
    // a value far outside its reference range should upgrade to 'abnormal' even
    // when the EHR only emits generic H/L codes rather than HH/LL.
    if (worst === 'abnormal' || worst === 'ok') return worst;

    // --- 2. referenceRange comparison ---
    const candidates: Array<{ value: number; ranges: Observation['referenceRange'] }> = [];

    if (obs.referenceRange?.length) {
        const n = extractObservationNumericValue(obs);
        if (n !== null) candidates.push({ value: n, ranges: obs.referenceRange });
    }

    // also check components
    for (const comp of obs.component ?? []) {
        if (comp.referenceRange?.length) {
            const n = (() => {
                const raw = comp.valueQuantity?.value ?? comp.valueQuantity?.value;
                return raw !== undefined ? Number(raw) : null;
            })();
            if (n !== null) candidates.push({ value: n, ranges: comp.referenceRange as Observation['referenceRange'] });
        }
    }

    for (const { value, ranges } of candidates) {
        for (const rr of ranges ?? []) {
            const lo = rr.low?.value;
            const hi = rr.high?.value;
            if (lo === undefined && hi === undefined) continue;

            if (lo !== undefined && value < lo) {
                // How many range-widths below the lower bound?
                const width = hi !== undefined ? hi - lo : undefined;
                const ratio = width !== undefined && width > 0 ? (lo - value) / width : undefined;
                upgrade(ratio !== undefined && ratio > 0.25 ? 'abnormal' : 'warn');
            } else if (hi !== undefined && value > hi) {
                const width = lo !== undefined ? hi - lo : undefined;
                const ratio = width !== undefined && width > 0 ? (value - hi) / width : undefined;
                upgrade(ratio !== undefined && ratio > 0.25 ? 'abnormal' : 'warn');
            } else {
                upgrade('ok');
            }
        }
    }

    return worst;
}

export function extractObservationNumericValue(obs: Observation): number | null {
    // Prefer valueQuantity — the only FHIR type that is unambiguously numeric.
    // Do NOT go through the display string: text values like "2+ protein" or
    // "1 pack/day" would be parsed by parseFloat and produce spurious flat lines.
    if (obs.valueQuantity?.value !== undefined) {
        const n = Number(obs.valueQuantity.value);
        return isNaN(n) ? null : n;
    }

    // For BP-style component observations, use the systolic component.
    if (obs.component?.length) {
        const SYSTOLIC = new Set(['8480-6', '271649006']);
        const sys = obs.component.find(c =>
            (c.code?.coding ?? []).some(cd => SYSTOLIC.has(cd.code ?? '')) ||
            /systolic/i.test(c.code?.text ?? '')
        );
        if (sys?.valueQuantity?.value !== undefined) {
            const n = Number(sys.valueQuantity.value);
            return isNaN(n) ? null : n;
        }
    }

    return null;
}

export function getObservationDate(obs: Observation): Date | null {
    const dateStr = obs.effectiveDateTime || obs.issued || null;
    return dateStr ? new Date(dateStr) : null;
}

export function getObservationValue(obs: Observation, { precision = 2 }: { precision?: number } = {}): { value: string, unit: string | null } {
    const {
        valueQuantity,
        valueString,
        valueCodeableConcept,
        valueBoolean,
        valueDateTime,
        valuePeriod,
        valueRange,
        valueRatio,
        valueTime,
        component
    } = obs;

    // Special handling: blood pressure observations often use `component`
    // with systolic/diastolic in sub-observations. If present, prefer
    // rendering as "SYS/DIA unit".
    if (component && Array.isArray(component)) {
        const comps = component as any[];
        
        // Known LOINC codes for systolic/diastolic
        const SYSTOLIC  = new Set(['8480-6', '271649006']);
        const DIASTOLIC = new Set(['8462-4', '271650006']);

        let systolic: any = null;
        let diastolic: any = null;

        for (const c of comps) {
            const code = c.code;
            const coding = code?.coding || [];
            const codes = coding.map((cd: any) => cd.code).filter(Boolean);
            const text = code?.text || '';

            if (codes.some((cc: string) => SYSTOLIC.has(cc)) || /systolic/i.test(text)) {
                systolic = c.valueQuantity || c.valueQuantity || c.value || null;
                continue;
            }
            if (codes.some((cc: string) => DIASTOLIC.has(cc)) || /diastolic/i.test(text)) {
                diastolic = c.valueQuantity || c.valueQuantity || c.value || null;
                continue;
            }
        }

        if (systolic && diastolic) {
            const sVal = Number((systolic.value !== undefined) ? String(systolic.value) : String(systolic)).toFixed(0);
            const dVal = Number((diastolic.value !== undefined) ? String(diastolic.value) : String(diastolic)).toFixed(0);
            const unit = systolic.unit || diastolic.unit || '';
            return { value: `${sVal}/${dVal}`, unit: unit ? cleanUnit(unit) : null };
        }
            
        else if (comps.length > 0) {
            // Fallback: join component displays
            const parts = comps.map((c) => {
                const codeText = c.code?.text || (c.code?.coding && c.code.coding[0]?.display) || (c.code?.coding && c.code.coding[0]?.code) || '';
                let v: string | null = null;
                if (c.valueQuantity) v = `${isNaN(+c.valueQuantity.value) ? c.valueQuantity.value : roundToPrecision(Number(c.valueQuantity.value), precision)}${c.valueQuantity.unit ? ' ' + cleanUnit(c.valueQuantity.unit) : ''}`;
                else if (c.valueString) v = c.valueString;
                else if (c.valueCodeableConcept) v = c.valueCodeableConcept.text || (c.valueCodeableConcept.coding && c.valueCodeableConcept.coding[0]?.display) || (c.valueCodeableConcept.coding && c.valueCodeableConcept.coding[0]?.code) || '';
                // Skip components with no extractable value — avoids "Line 1: null" noise
                if (!v) return null;
                return codeText ? `${codeText}: ${v}` : v;
            }).filter(Boolean);

            if (parts.length) {
                return { value: parts.join(' | '), unit: null };
            }
        }
    }

    if (valueQuantity) {
        const value = String(valueQuantity.value || '');
        const unit  = valueQuantity.unit || '';
        return { value: `${isNaN(+value) ? value : roundToPrecision(Number(value), precision)}`.trim(), unit: unit ? cleanUnit(unit) : null };
    }
    if (valueString) {
        return { value: valueString.trim(), unit: null };
    }
    if (valueCodeableConcept) {
        const text = valueCodeableConcept.text
            || valueCodeableConcept.coding?.find(c => c.display)?.display
            || valueCodeableConcept.coding?.[0]?.code
            || '';
        return { value: text, unit: null };
    }
    if (valueBoolean !== undefined) {
        return { value: valueBoolean.toString(), unit: null };
    }
    if (valueDateTime) {
        return { value: valueDateTime, unit: null };
    }
    if (valuePeriod) {
        const period = valuePeriod;
        const start = period.start ? period.start : '';
        const end = period.end ? period.end : '';
        return { value: start && end ? `${start} - ${end}` : start || end || '', unit: null };
    }
    if (valueRange) {
        const range = valueRange;
        const low = range.low ? `${range.low.value} ${range.low.unit || ''}`.trim() : '';
        const high = range.high ? `${range.high.value} ${range.high.unit || ''}`.trim() : '';
        return { value: low && high ? `${low} - ${high}` : low || high || '', unit: null };
    }
    if (valueRatio) {
        const ratio = valueRatio;
        const numerator = ratio.numerator ? `${ratio.numerator.value} ${ratio.numerator.unit || ''}`.trim() : '';
        const denominator = ratio.denominator ? `${ratio.denominator.value} ${ratio.denominator.unit || ''}`.trim() : '';
        return { value: numerator && denominator ? `${numerator} / ${denominator}` : numerator || denominator || '', unit: null };
    }
    if (valueTime) {
        return { value: valueTime, unit: null };
    }
    // valueInteger is a valid FHIR Observation value type not covered above
    if ((obs as any).valueInteger !== undefined) {
        return { value: String((obs as any).valueInteger), unit: null };
    }

    return { value: '', unit: null };
}

/**
 * Maps UCUM unit codes to display-friendly strings.
 * Exact matches are tried first, then pattern substitutions.
 */
export const UNIT_EXACT: Record<string, string> = {
    // Temperature
    'Cel':              '°C',
    '[degF]':           '°F',
    // Pressure
    'mm[Hg]':           'mmHg',
    'kPa':              'kPa',
    // Frequency / rates
    '/min':             '/min',
    '{beats}/min':      'bpm',
    '{breaths}/min':    'breaths/min',
    // Concentration
    'mg/dL':            'mg/dL',
    'mmol/L':           'mmol/L',
    'umol/L':           'µmol/L',
    'nmol/L':           'nmol/L',
    'g/dL':             'g/dL',
    'g/L':              'g/L',
    'ng/mL':            'ng/mL',
    'ug/mL':            'µg/mL',
    'pg/mL':            'pg/mL',
    'IU/L':             'IU/L',
    'U/L':              'U/L',
    'mIU/mL':           'mIU/mL',
    // Cell counts
    '10*3/uL':          '×10³/µL',
    '10*6/uL':          '×10⁶/µL',
    '10*9/L':           '×10⁹/L',
    '/uL':              '/µL',
    // Volume / flow
    'mL':               'mL',
    'L':                'L',
    'L/min':            'L/min',
    'mL/min':           'mL/min',
    'mL/min/{1.73_m2}': 'mL/min/1.73m²',
    // Mass
    'kg':               'kg',
    'g':                'g',
    'mg':               'mg',
    // Length
    'cm':               'cm',
    'm':                'm',
    // Ratio / fraction
    '%':                '%',
    // Time
    's':                'sec',
    'ms':               'ms',
    'min':              'min',
    'h':                'hr',
    // Score annotations — self-reported scales
    '{score}':          'score',
    '{Score}':          'score',
    '{VAS_score}':      'VAS score',
    '{NRS_score}':      'NRS score',
    '{points}':         'pts',
};

/** Scored / self-reported annotation patterns. */
export const SELF_REPORTED_PATTERN = /^\{.*(score|scale|index|rating|survey|questionnaire|reported|VAS|NRS|CDAI|HBI|SCCAI|PRO).*\}$/i;

export function cleanUnit(raw: string): string {
    const trimmed = raw.trim();

    // 1. Exact lookup
    if (UNIT_EXACT[trimmed]) return UNIT_EXACT[trimmed];

    // 2. Self-reported scoring scales → "score"
    if (SELF_REPORTED_PATTERN.test(trimmed)) return 'score';

    // 3. Strip UCUM annotation braces: {anything} → anything
    if (/^\{(.+)\}$/.test(trimmed)) return trimmed.slice(1, -1);

    // 4. Inline annotation stripping: e.g. {beats}/min → /min, then re-lookup
    const stripped = trimmed.replace(/\{[^}]*\}/g, '').trim();
    if (stripped !== trimmed && UNIT_EXACT[stripped]) return UNIT_EXACT[stripped];

    return stripped || trimmed;
}

export function extractNumericValue(obs: Observation): number | null {
    // Prefer valueQuantity — the only FHIR type that is unambiguously numeric.
    // Do NOT go through the display string: text values like "2+ protein" or
    // "1 pack/day" would be parsed by parseFloat and produce spurious flat lines.
    if (obs.valueQuantity?.value !== undefined) {
        const n = Number(obs.valueQuantity.value);
        return isNaN(n) ? null : n;
    }

    // For BP-style component observations, use the systolic component.
    if (obs.component?.length) {
        const SYSTOLIC = new Set(['8480-6', '271649006']);
        const sys = obs.component.find(c =>
            (c.code?.coding ?? []).some(cd => SYSTOLIC.has(cd.code ?? '')) ||
            /systolic/i.test(c.code?.text ?? '')
        );
        if (sys?.valueQuantity?.value !== undefined) {
            const n = Number(sys.valueQuantity.value);
            return isNaN(n) ? null : n;
        }
    }

    return null;
}

/** Threshold below which a change is considered flat (relative fraction). */
export const FLAT_THRESHOLD = 0.02; // 2%

/**
 * Determines whether a change is clinically improving or worsening by comparing
 * the status rank of the latest vs previous observation. Falls back to 'flat'
 * when neither observation has a reference range or interpretation.
 */
export function computeClinicalDirection(
    latest: Observation,
    previous: Observation
): 'improving' | 'worsening' | 'flat' {
    const STATUS_RANK: Record<string, number> = { ok: 0, warn: 1, abnormal: 2 };
    const latestStatus  = getObservationStatus(latest);
    const previousStatus = getObservationStatus(previous);

    if (latestStatus === null || previousStatus === null) return 'flat';

    const latestRank  = STATUS_RANK[latestStatus]  ?? -1;
    const previousRank = STATUS_RANK[previousStatus] ?? -1;

    if (latestRank < previousRank) return 'improving';
    if (latestRank > previousRank) return 'worsening';

    // Same status bucket — use distance from reference range midpoint if available
    const latestN  = extractNumericValue(latest);
    const previousN = extractNumericValue(previous);
    const rr = latest.referenceRange?.[0] ?? previous.referenceRange?.[0];
    if (rr && latestN !== null && previousN !== null) {
        const lo = rr.low?.value ?? latestN;
        const hi = rr.high?.value ?? latestN;
        const mid = (lo + hi) / 2;
        const latestDist  = Math.abs(latestN  - mid);
        const previousDist = Math.abs(previousN - mid);
        if (latestDist < previousDist - 0.001) return 'improving';
        if (latestDist > previousDist + 0.001) return 'worsening';
    }

    return 'flat';
}

export type DeltaResult = { text: string; direction: 'improving' | 'worsening' | 'flat' };

export function computeDelta(observations: Observation[]): DeltaResult | null {
    const sorted = [...observations]
        .map(obs => ({ date: getObservationDate(obs), obs }))
        .filter(({ date }) => date !== null)
        .sort((a, b) => b.date!.getTime() - a.date!.getTime());

    if (sorted.length < 2) return null;

    const latest  = sorted[0].obs;
    const previous = sorted[1].obs;

    // --- Blood pressure: break out systolic / diastolic separately ---
    const SYSTOLIC  = new Set(['8480-6', '271649006']);
    const DIASTOLIC = new Set(['8462-4', '271650006']);

    function getBPComponent(obs: Observation, codes: Set<string>): number | null {
        for (const c of obs.component ?? []) {
            const codings = c.code?.coding ?? [];
            if (codings.some(cd => codes.has(cd.code ?? ''))) {
                const v = c.valueQuantity?.value;
                return v !== undefined ? Number(v) : null;
            }
        }
        return null;
    }

    const latestSys  = getBPComponent(latest, SYSTOLIC);
    const prevSys    = getBPComponent(previous, SYSTOLIC);
    const latestDia  = getBPComponent(latest, DIASTOLIC);
    const prevDia    = getBPComponent(previous, DIASTOLIC);

    if (latestSys !== null && prevSys !== null) {
        const sysDelta = latestSys - prevSys;
        const diaDelta = (latestDia !== null && prevDia !== null) ? latestDia - prevDia : null;
        // Report whichever component changed more
        const dominant = diaDelta !== null && Math.abs(diaDelta) > Math.abs(sysDelta) ? 'diastolic' : 'systolic';
        const delta = dominant === 'systolic' ? sysDelta : diaDelta!;
        const rel = Math.abs(delta) / (dominant === 'systolic' ? prevSys : prevDia!);
        if (rel < FLAT_THRESHOLD) return { text: '— stable', direction: 'flat' };
        const sign = delta > 0 ? '+' : '';
        const arrow = delta > 0 ? '↑' : '↓';
        return { text: `${arrow} ${sign}${roundToPrecision(delta, 0)} ${dominant}`, direction: computeClinicalDirection(latest, previous) };
    }

    // --- Generic numeric ---
    const latestVal  = extractNumericValue(latest);
    const previousVal = extractNumericValue(previous);
    if (latestVal === null || previousVal === null) return null;

    const delta = latestVal - previousVal;
    const rel   = previousVal !== 0 ? Math.abs(delta) / Math.abs(previousVal) : Math.abs(delta);

    if (rel < FLAT_THRESHOLD) return { text: 'stable', direction: 'flat' };

    const { unit } = getObservationValue(latest);
    const sign  = delta > 0 ? '+' : '';
    const arrow = delta > 0 ? '↑' : '↓';
    const suffix = unit ? ` ${unit}` : '';
    return {
        text: `${arrow} ${sign}${roundToPrecision(delta, 1)}${suffix}`.trim(),
        direction: computeClinicalDirection(latest, previous)
    };
}

/**
 * Returns a stable grouping key for an observation, preferring canonical
 * coding system codes over display text. This avoids duplicate cards when the
 * same observation concept is emitted with different text strings (e.g. "Temp src"
 * and "Temperature Source" share the same LOINC code).
 *
 * All LOINC codes present are combined into the key (sorted for stability) so
 * that a multi-coded observation (e.g. a BP panel with both a panel code and a
 * site code) gets a distinct key from a single-coded standalone observation
 * (e.g. a standalone BP-location observation). Using only the first LOINC code
 * would cause such observations to be merged into the same group, hiding
 * the single-coded one behind the more-recent multi-coded one.
 *
 * Priority:
 *   1. All LOINC codes — sorted and joined (most specific)
 *   2. All SNOMED/SCT codes — sorted and joined
 *   3. Any other coding with a non-empty code (first found)
 *   4. Normalized display name (lowercase, trimmed) as last resort
 */
export function getObservationGroupKey(obs: Observation): string {
    const codings = obs.code?.coding ?? [];

    const loincCodes = codings
        .filter(c => (c.system ?? '').toLowerCase().includes('loinc') && c.code)
        .map(c => c.code!)
        .sort();
    if (loincCodes.length > 0) return `loinc|${loincCodes.join('+')}`;

    const snomedCodes = codings
        .filter(c => {
            const sys = (c.system ?? '').toLowerCase();
            return (sys.includes('snomed') || sys.includes('sct')) && c.code;
        })
        .map(c => c.code!)
        .sort();
    if (snomedCodes.length > 0) return `snomed|${snomedCodes.join('+')}`;

    // Fall back to any coding that has a code
    const any = codings.find(c => c.code);
    if (any) return `${(any.system ?? 'unknown').toLowerCase()}|${any.code}`;

    // Last resort: normalized display name
    return getObservationDisplayName(obs).toLowerCase().trim();
}
