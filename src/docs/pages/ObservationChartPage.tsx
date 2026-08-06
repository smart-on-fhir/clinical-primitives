import { useEffect, useRef } from "react";
import type { Observation } from "fhir/r4";
import { ObservationChart } from "../../components/Observation/ObservationChart";
import { useClinicalData } from "../../library";
import { ClinicalPageHeader } from "../components/ClinicalPageHeader";
import bundle from "../samplePatientBundle.json";

/** LOINC codes used on this page. */
const CODES = {
    crp        : "1988-5",
    albumin    : "1751-7",
    bloodPressure: "55284-4",
    systolic   : "8480-6",
    diastolic  : "8462-4",
    glucose    : "2339-0",
    hba1c      : "4548-4",
    cholesterol: "2093-3",
    creatinine : "38483-4",
    weight     : "29463-7"
};

export function ObservationChartPage() {
    const { loadFromBundle, resources } = useClinicalData();

    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Seed the sample only when the provider is still empty. The provider
        // outlives this page, so reloading unconditionally would throw away a
        // patient the user selected and then navigated away from.
        if (!resources || Object.keys(resources).length === 0) {
            loadFromBundle(bundle as any);
        }
    }, []);

    const observations = (resources?.Observation ?? []) as unknown as Observation[];

    // Checked against whatever is loaded rather than stated as a fact about the
    // sample bundle, so the note stays true after another patient is selected.
    const has = (code: string) =>
        observations.some(obs => (obs.code?.coding ?? []).some(coding => coding.code === code));

    const missing = [
        !has(CODES.crp)     && "CRP",
        !has(CODES.albumin) && "Albumin"
    ].filter((entry): entry is string => Boolean(entry));

    return (
        <section>
            <ClinicalPageHeader title="ObservationChart" />

            <article className="mb-12">
                <h3 className="mb-2">Requested analytes</h3>
                { missing.length > 0 &&
                    <p className="mb-6 cp-text-txt-5">
                        {missing.join(" and ")} {missing.length === 1 ? "is" : "are"} not present in the
                        loaded record, so {missing.length === 1 ? "it renders" : "they render"} the empty
                        state. Load a bundle that contains {missing.length === 1 ? "it" : "them"} and these
                        charts populate with no code change.
                    </p> }

                <div className="mb-8">
                    <ObservationChart
                        crosshair
                        observations={observations}
                        code={CODES.crp}
                        label="C-Reactive Protein"
                    />
                </div>

                <div className="mb-8">
                    <ObservationChart
                        crosshair
                        observations={observations}
                        code={CODES.albumin}
                        label="Albumin"
                    />
                </div>

                {/* Two lines from one observation: BP keeps systolic and diastolic
                    in `component`, which the chart picks up on its own. */}
                <div className="mb-8">
                    <ObservationChart
                        crosshair
                        observations={observations}
                        code={CODES.bloodPressure}
                        label="Blood Pressure"
                        height={220}
                    />
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Explicit series</h3>
                <p className="mb-6 cp-text-txt-5">
                    The same blood pressure observations, but naming the components explicitly rather than
                    letting the chart infer them — which is how to control label, color and ordering, or to
                    plot only one of several components.
                </p>

                <ObservationChart
                    observations={observations}
                    code={CODES.bloodPressure}
                    label="Blood Pressure (systolic only)"
                    series={[
                        // Not red: on this chart red marks a reading outside its
                    // reference interval, so spending it on series identity
                    // would make an ordinary systolic line look like a finding.
                    { code: CODES.systolic, label: "Systolic", color: "var(--cp-color-purple)" }
                    ]}
                />
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Common single-value analytes</h3>
                <p className="mb-6 cp-text-txt-5">
                    Observations carrying their value directly, one line each. Any the loaded record does
                    not contain show the empty state. Hover a point for its value and date.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ObservationChart crosshair observations={observations} code={CODES.glucose}     label="Glucose" />
                    <ObservationChart crosshair observations={observations} code={CODES.hba1c}       label="Hemoglobin A1c" />
                    <ObservationChart crosshair observations={observations} code={CODES.cholesterol} label="Total Cholesterol" />
                    <ObservationChart crosshair observations={observations} code={CODES.creatinine}  label="Creatinine" />
                    <ObservationChart crosshair observations={observations} code={CODES.weight}      label="Body Weight" />
                </div>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Notes</h3>
                <ul className="cp-text-txt-5" style={{ listStyle: "disc", paddingLeft: "1.25em" }}>
                    <li className="mb-2">
                        The curve is monotone cubic, not a plain spline. It passes through every reading and
                        cannot overshoot between them, so the line never implies a peak or trough that was
                        not measured.
                    </li>
                    <li className="mb-2">
                        Only <code>valueQuantity</code> is plotted. Coded and free-text results are skipped
                        rather than coerced into numbers.
                    </li>
                    <li className="mb-2">
                        Stretches of the curve outside the reference interval are drawn in a second color.
                        Bounds come from the observation's own <code>referenceRange</code> first, then from
                        a table supplied via the <code>referenceRange</code> prop. Readings with neither are
                        left uncolored — which reads as "not assessed", not as "normal".
                    </li>
                    <li className="mb-2">
                        The sample bundle carries no <code>referenceRange</code> on any observation, so
                        nothing on this page is colored. A record that has them, or a table passed in, is
                        needed to see it.
                    </li>
                </ul>
            </article>
        </section>
    );
}
