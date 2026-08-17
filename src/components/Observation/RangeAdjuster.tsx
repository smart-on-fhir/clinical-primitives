import { useEffect, useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import { type Bounds, type RangeOverride } from "./referenceRange";
import "./RangeAdjuster.scss";

/**
 * What a reader has entered for one analyte's two bounds.
 *
 * The same three states an override carries, because they are the same three
 * states: a side left alone resolves per reading as it always did, a figure
 * replaces it, and an emptied box withdraws it. Nothing is gained by holding
 * these as a separate shape and then translating.
 */
export type RangeEdits = RangeOverride;

/** The span an analyte's controls work over. */
export interface BoundScale {
    min: number,
    max: number
}

/**
 * The figure in force for one side, counting what resolved where nothing was
 * typed.
 *
 * `undefined` in the edits is not "no bound" — it is "whatever the sources say",
 * which is why the published value has to be consulted to answer this at all.
 * `null` is the one that means no bound.
 */
function inForce(edits: RangeEdits, key: "low" | "high", published: Bounds): number | undefined {
    return edits[key] === undefined ? published[key] : edits[key] ?? undefined;
}

/**
 * Whether these edits would close the interval, leaving nothing normal.
 *
 * Past that point the chart cannot draw the band as anything but a hard edge
 * between the two abnormal zones, at a value that means nothing. Rather than
 * clamp the reader's figure to something they did not type — which would leave
 * the readout describing an interval the chart is not using — the caller is
 * expected to say so and apply nothing until it is resolved.
 */
export function editsCross(edits: RangeEdits, published: Bounds): boolean {
    const low  = inForce(edits, "low", published);
    const high = inForce(edits, "high", published);

    // A withdrawn side is a bound that is not there, and a bound that is not
    // there cannot be crossed. Only two live figures can close an interval.
    return low !== undefined && high !== undefined && low >= high;
}

/**
 * The span the controls work over: what the analyte actually does, widened by
 * as much again on each side.
 *
 * Derived from the readings rather than fixed, because there is no one answer
 * across analytes running from single figures to the hundreds. A limit outside
 * this has nowhere to draw anyway — a zone entirely off the plot tints no part
 * of the curve — so clamping to it turns "I typed 400 and nothing happened" into
 * a figure that visibly lands.
 *
 * The resolved bounds are folded in before the widening. Without that an analyte
 * whose published ceiling sits above everything the patient has — the ordinary
 * case for someone in remission — would open its control on a figure its own
 * limits then clamp away.
 */
export function boundScale(values: number[], published: Bounds): BoundScale | null {
    const points = [
        ...values,
        ...(published.low  !== undefined ? [published.low]  : []),
        ...(published.high !== undefined ? [published.high] : [])
    ].filter(Number.isFinite);

    if (points.length === 0) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);

    // A single reading, or a flat series, leaves nothing to measure the padding
    // against. Its own magnitude is the only scale on offer, and a bare 1 covers
    // the analyte that reads zero.
    const span = max > min ? max - min : Math.abs(max) || 1;

    return { min: min - span, max: max + span };
}

/**
 * A step that moves the figure by about a hundredth of its span, rounded to
 * something a reader would have picked.
 *
 * A fixed step cannot serve both CRP, whose whole interval is under 5, and
 * platelets, which runs into the hundreds: one would need a hundred presses to
 * cross the plot and the other would leap over it.
 */
export function niceStep(span: number): number {
    if (!Number.isFinite(span) || span <= 0) return 1;

    const magnitude = Math.pow(10, Math.floor(Math.log10(span / 100)));
    const scaled    = span / 100 / magnitude;

    return (scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1) * magnitude;
}

/** Decimals to hold a figure to, given the step it moves in. */
function precisionFor(step: number): number {
    return Math.max(0, Math.min(6, -Math.floor(Math.log10(step))));
}

/** How a bound is written into its input. */
function draftOf(value: number | null | undefined, published?: number): string {
    // Untouched shows what applies; withdrawn shows nothing, which is the same
    // thing the box would show for an analyte that never had this bound. Both
    // are the honest reading of an empty field: no limit on this side.
    const shown = value === undefined ? published : value ?? undefined;
    return shown === undefined ? "" : String(shown);
}

function BoundRow({ name, label, suffix, value, published, limits, step, onChange }: {
    name: string,
    label: string,
    suffix: string,

    /** Undefined leaves it to the sources; a number overrides; null withdraws. */
    value: number | null | undefined,

    /** What the sources say, shown while the reader has not said otherwise. */
    published?: number,

    limits: { min: number, max: number },
    step: number,
    onChange: (value: number | null | undefined) => void
}) {
    const id = useId();

    // The input keeps its own text because what a reader types is not always a
    // number yet — a lone "-" or ".", or the empty box between clearing and
    // retyping. The draft holds those; the chart only ever sees the figures that
    // parse.
    const [draft, setDraft] = useState(() => draftOf(value, published));
    const [focused, setFocused] = useState(false);

    // Re-synced when the value moves underneath — a reset, or a preset arriving.
    // Never while the reader is in the field: a commit echoing back through here
    // would rewrite "12.50" to "12.5" under their cursor mid-entry, and would
    // blank the box the moment a half-typed entry failed to parse.
    useEffect(() => {
        if (!focused) setDraft(draftOf(value, published));
    }, [value, published, focused]);

    const commit = (text: string, settled: boolean) => {
        const trimmed = text.trim();
        const parsed  = Number(trimmed);

        // Anything that is not yet a number waits for the field to settle. This
        // is not a debounce — every figure that parses lands at once — it only
        // covers the states a number input passes through on the way to one.
        //
        // The empty box is the case that would actually be felt: it withdraws
        // the bound, so acting on it mid-edit would drop the band between two
        // keystrokes of retyping it.
        if (trimmed === "" || !Number.isFinite(parsed)) {
            if (!settled) return;

            // An emptied box is a bound the reader has taken off, not one they
            // forgot to fill. The reset control beside it is how the published
            // figure comes back.
            return trimmed === "" ? onChange(null) : setDraft(draftOf(value, published));
        }

        // Clamped to where the figure can still draw something, and held to the
        // precision the step implies so the box and the chart never disagree
        // about what is in force.
        const bounded = Math.min(limits.max, Math.max(limits.min, parsed));
        const next    = Number(bounded.toFixed(precisionFor(step)));

        if (next !== value) onChange(next);
    };

    // Applied as it is typed. Blur is not a signal that an edit has finished —
    // the spinner arrows and the up/down keys both change the value while the
    // field keeps focus — and waiting for it left changes sitting in the box
    // with the chart still drawn against the old figure.
    const edit = (text: string) => {
        setDraft(text);
        commit(text, false);
    };

    return (
        <div className="cp-range-adjuster-row">
            <label className="cp-range-adjuster-name" htmlFor={id}>{name}</label>
            <input
                id={id}
                type="number"
                inputMode="decimal"
                className="cp-range-adjuster-input"
                step={step}
                min={limits.min}
                max={limits.max}
                value={draft}
                onChange={event => edit(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={event => { setFocused(false); commit(event.target.value, true); }}
                onKeyDown={event => {
                    if (event.key === "Enter") { event.preventDefault(); commit(draft, true); }
                    if (event.key === "Escape") setDraft(draftOf(value, published));
                }}
            />
            <span className="cp-range-adjuster-suffix">{suffix}</span>
            {/* Only where pressing it would change something. Reset puts this
                side back to what the sources say, so it has nothing to do
                wherever that is already what applies — a figure typed back to
                the published one, or an emptied box on an analyte that never had
                this bound.

                Deliberately the same test the row's "custom" badge uses. The two
                answer the same question — has this side been moved off what the
                sources say — and a button offering to undo something the label
                says is not there reads as one of them being wrong. */}
            { value !== undefined && (value ?? undefined) !== published &&
                <button
                    type="button"
                    className="cp-range-adjuster-reset"
                    onClick={() => onChange(undefined)}
                    title={ published === undefined
                        ? `Clear the ${name.toLowerCase()} bound for ${label}`
                        : `Restore the published ${name.toLowerCase()} bound for ${label}` }
                    aria-label={ published === undefined
                        ? `Clear the ${name.toLowerCase()} bound for ${label}`
                        : `Restore the published ${name.toLowerCase()} bound for ${label}` }
                >
                    <RotateCcw size={13} aria-hidden />
                </button> }
        </div>
    );
}

/**
 * Editors for the two limits one analyte is read against.
 *
 * Absolute figures in the analyte's own unit, whether or not anything published
 * them. "Flag CRP above 15" is a claim a clinician can make and check on the
 * chart; the same limit expressed as a factor would require knowing the number
 * it multiplies, which the chart never shows.
 *
 * Each side opens on whatever currently applies, so the first thing a reader
 * sees is the interval already in force rather than an empty box they have to
 * fill before anything makes sense. Editing one leaves the other alone — and a
 * side left alone goes on resolving per reading, so an age-banded floor keeps
 * moving under a pinned ceiling.
 *
 * Emptying a box takes that bound off. This is how a one-sided interval is
 * asked for, and one-sided is the ordinary shape for an inflammatory marker,
 * where only the ceiling means anything. The reset beside each row puts the
 * published figure back.
 */
export function RangeAdjuster({ label, unit, published, scale, value, onChange, className }: {
    /** The analyte these bounds belong to, for the controls' accessible names. */
    label: string,

    /**
     * The unit the analyte's readings are reported in, shown after each figure.
     * Without it there is nothing to say what is being typed, so the control
     * renders nothing rather than invite a number with no scale.
     */
    unit?: string | null,

    /** What currently resolves for this analyte, and what the inputs open on. */
    published: Bounds,

    /** The span the inputs work over — see {@link boundScale}. */
    scale: BoundScale | null,

    value: RangeEdits,

    onChange: (value: RangeEdits) => void,

    className?: string
}) {
    if (!unit || !scale) return null;

    const step    = niceStep(scale.max - scale.min);
    const crossed = editsCross(value, published);

    // Each side is held clear of the other, so the pair cannot be walked into an
    // interval with nothing inside it. The live figures are what they are held
    // against, not the published ones — the reader is working with what is on
    // screen.
    const low  = inForce(value, "low",  published);
    const high = inForce(value, "high", published);

    const row = (name: "High" | "Low", key: "high" | "low") => (
        <BoundRow
            name={name}
            label={label}
            suffix={unit}
            step={step}
            limits={ key === "high"
                ? { min: Math.max(scale.min, low ?? scale.min), max: scale.max }
                : { min: scale.min, max: Math.min(scale.max, high ?? scale.max) } }
            value={value[key]}
            published={published[key]}
            onChange={next => onChange({ ...value, [key]: next })}
        />
    );

    return (
        <div className={`cp-range-adjuster${className ? " " + className : ""}`}>
            { row("High", "high") }
            { row("Low",  "low") }
            {/* Stated rather than silently corrected, and stated as the reason
                nothing is being applied — otherwise the chart quietly ignoring
                the figures on screen looks like the control is broken. */}
            { crossed &&
                <p className="cp-range-adjuster-error" role="alert">
                    Low is at or above High — not applied.
                </p> }
        </div>
    );
}
