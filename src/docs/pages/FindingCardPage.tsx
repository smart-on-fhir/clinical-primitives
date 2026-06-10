import { FindingCard, type EvidenceTab } from "../../components/FindingCard";
import { CodeBlock }   from "../components/CodeBlock";

// ---------------------------------------------------------------------------
// Shared evidence data
// ---------------------------------------------------------------------------

const akiTabs: EvidenceTab[] = [
    {
        label: 'Labs',
        items: [
            { kind: 'lab',  name: 'Creatinine (today)', value: '2.1', unit: 'mg/dL',  sub: 'Baseline 1.2 · +75% over 72h',  flag: 'critical' },
            { kind: 'lab',  name: 'eGFR (today)',       value: '32',  unit: 'mL/min', sub: 'Was 58 on admission',           flag: 'high'     },
            { kind: 'lab',  name: 'BUN',                value: '34',  unit: 'mg/dL',  sub: 'Ref 7-25',                      flag: 'high'     },
            { kind: 'lab',  name: 'Urine output',       value: '340', unit: 'mL/8h',  sub: 'Oliguria threshold <400 mL/8h', flag: 'high'     },
            { kind: 'narrative', text: 'Creatinine **rise ≥0.3 mg/dL within 48h** meets KDIGO Stage 1 AKI criteria. Concurrent oliguria suggests **progression to Stage 2**.' },
        ],
    },
    {
        label: 'Medications',
        items: [
            { kind: 'med', name: 'Vancomycin IV',  note: 'active since admission', tag: 'Nephrotoxic',       tagVariant: 'warning' },
            { kind: 'med', name: 'Pip-tazo IV',    note: 'stopped D4',             tag: 'Was nephrotoxic',   tagVariant: 'warning' },
            { kind: 'med', name: 'Metformin PO',   note: 'held D2',                tag: 'Held appropriately', tagVariant: 'success' },
            { kind: 'med', name: 'Lisinopril PO',  note: 'held D2',                tag: 'Held appropriately', tagVariant: 'success' },
        ],
    },
    {
        label: 'Vitals',
        items: [
            { kind: 'vital', name: 'BP (06:14)',        value: '88/54', sub: 'Hypotension — worsens renal perfusion', flag: 'critical' },
            { kind: 'vital', name: 'HR',                value: '108',   unit: 'bpm', flag: 'high' },
            { kind: 'vital', name: 'Urine output /8h',  value: '340',   unit: 'mL',  sub: 'Oliguria', flag: 'high' },
        ],
    },
    {
        label: 'Cohort',
        items: [
            { kind: 'cohort', stat: '34% risk of dialysis within 5 days', description: 'In 847 similar patients (CKD + vancomycin + hypotension), 34% developed AKI requiring dialysis within 5 days.', n: 847 },
        ],
    },
];

const sepsisTabs: EvidenceTab[] = [
    {
        label: 'Labs',
        items: [
            { kind: 'lab', name: 'WBC',      value: '18.4', unit: 'K/µL',  sub: 'Leukocytosis',    flag: 'high'     },
            { kind: 'lab', name: 'Lactate',  value: '3.2',  unit: 'mmol/L', sub: 'Ref <2.0',       flag: 'critical' },
            { kind: 'lab', name: 'CRP',      value: '182',  unit: 'mg/L',   sub: 'Ref <5',         flag: 'critical' },
            { kind: 'lab', name: 'Procalcitonin', value: '4.8', unit: 'ng/mL', sub: 'Ref <0.5',    flag: 'critical' },
        ],
    },
    {
        label: 'Vitals',
        items: [
            { kind: 'vital', name: 'Temp',  value: '38.9', unit: '°C',  flag: 'high'     },
            { kind: 'vital', name: 'HR',    value: '118',  unit: 'bpm', flag: 'high'     },
            { kind: 'vital', name: 'RR',    value: '24',   unit: '/min', flag: 'high'    },
            { kind: 'vital', name: 'SpO₂',  value: '93',   unit: '%',   flag: 'low'      },
        ],
    },
    {
        label: 'PUCAI Score',
        items: [
            {
                kind: 'score',
                name: 'PUCAI',
                total: '+10',
                components: [
                    { label: 'Abdominal pain',                   value: '+5'  },
                    { label: 'Rectal bleeding',                  value: '+20' },
                    { label: 'Stool consistency of most stools', value: '+5'  },
                    { label: 'Number of stools per 24 hrs',      value: '+5'  },
                    { label: 'Nocturnal stools',                 value: '+10' },
                ],
            },
        ],
    },
];

const dvtTabs: EvidenceTab[] = [
    {
        label: 'Imaging',
        items: [
            { kind: 'imaging', title: 'Lower extremity venous duplex ultrasound', date: 'Jun 4', conclusion: 'Acute non-occlusive thrombus in the right popliteal vein extending into the right posterior tibial vein.' },
            { kind: 'imaging', title: 'Chest CT-PA', date: 'Jun 5', conclusion: 'No evidence of pulmonary embolism. Mild right pleural effusion.' },
        ],
    },
    {
        label: 'Risk factors',
        items: [
            { kind: 'condition', name: 'Post-op day 3 (right TKR)',  status: 'Active' },
            { kind: 'condition', name: 'Obesity (BMI 38)',           status: 'Active' },
            { kind: 'condition', name: 'Prior DVT (2021)',           status: 'Historical' },
            { kind: 'narrative', text: 'Wells score 4 — high pre-test probability for DVT prior to imaging.' },
        ],
    },
    {
        label: 'Notes',
        items: [
            { kind: 'note', title: 'Orthopaedic surgery post-op note', date: 'Jun 3', category: 'Operative', snippet: 'Prophylactic enoxaparin held day of surgery, restarted POD1.' },
            { kind: 'note', title: 'Vascular surgery consult', date: 'Jun 5', snippet: 'Recommend therapeutic anticoagulation. Discussed IVC filter — deferred at this time.' },
        ],
    },
];


export function FindingCardPage() {
    return (
        <section className="mt-4 max-w-4xl">

            <header className="text-sky-500 uppercase mb-2">FindingCard</header>
            <p className="cp-text-txt-4 mb-6">
                A card component for displaying a single clinical finding with dynamic evidence tabs.
                Evidence tabs support lab/vital cells, medication rows, condition lists, imaging/note
                references, narrative prose, cohort statistics, and scoring rules.
            </p>

            <hr className="mb-6" />

            {/* ------------------------------------------------------------ */}

            <h3 className="mb-1">Minimal Version</h3>
            <p className="cp-text-txt-6 cp-text-sm mb-4">The only required props is <code>title</code>.</p>
            <CodeBlock language="tsx">{`<FindingCard title="Elevated HbA1c — diabetes management review recommended" />`}</CodeBlock>
            <div className="mb-8">
                <FindingCard title="Elevated HbA1c — diabetes management review recommended" />
            </div>

            {/* ------------------------------------------------------------ */}

            <h3 className="mb-1">Severity Variants</h3>
            <CodeBlock language="tsx">{`<FindingCard title="Elevated HbA1c — diabetes management review recommended" concernLevel="low" />`}</CodeBlock>
            <div className="mb-8">
                <FindingCard title="Elevated HbA1c — diabetes management review recommended" concernLevel="low" />
            </div>
            <CodeBlock language="tsx">{`<FindingCard title="Elevated HbA1c — diabetes management review recommended" concernLevel="moderate" />`}</CodeBlock>
            <div className="mb-8">
                <FindingCard title="Elevated HbA1c — diabetes management review recommended" concernLevel="moderate" />
            </div>
            <CodeBlock language="tsx">{`<FindingCard title="Elevated HbA1c — diabetes management review recommended" concernLevel="high" />`}</CodeBlock>
            <div className="mb-8">
                <FindingCard title="Elevated HbA1c — diabetes management review recommended" concernLevel="high" />
            </div>

            {/* ------------------------------------------------------------ */}

            <h3 className="mb-1">Add a short description</h3>
            <CodeBlock language="tsx">{`<FindingCard
    title="Elevated HbA1c — diabetes management review recommended"
    concernLevel="moderate"
    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
/>`}</CodeBlock>
            <div className="mb-8">
                <FindingCard
                    title="Elevated HbA1c — diabetes management review recommended"
                    concernLevel="moderate"
                    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
                />
            </div>

            {/* ------------------------------------------------------------ */}

            <h3 className="mb-1">Dismissible</h3>
            <CodeBlock language="tsx">{`<FindingCard
    title="Elevated HbA1c — diabetes management review recommended"
    concernLevel="high"
    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
    dismiss={() => { alert('Dismiss clicked') }}
/>`}</CodeBlock>
            <div className="mb-8">
                <FindingCard
                    title="Elevated HbA1c — diabetes management review recommended"
                    concernLevel="high"
                    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
                    dismiss={() => { alert('Dismiss clicked') }}
                />
            </div>

            {/* ------------------------------------------------------------ */}

            <h3 className="mb-1">Add confidence level</h3>
            <p className="cp-text-txt-6 cp-text-sm mb-4">
                Since these findings are often LLM-generated, there may be uncertainty around their accuracy.
                You can optionally provide a confidence level (0-1) to visually indicate this uncertainty with
                a progress bar in the header.
            </p>
            <CodeBlock language="tsx">{`<FindingCard
    title="Elevated HbA1c — diabetes management review recommended"
    concernLevel="high"
    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
    dismiss={() => {}}
    confidenceLevel={0.75}
/>`}</CodeBlock>
            <div className="mb-8">
                <FindingCard
                    title="Elevated HbA1c — diabetes management review recommended"
                    concernLevel="high"
                    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
                    dismiss={() => {}}
                    confidenceLevel={0.75}
                />
            </div>

            {/* ------------------------------------------------------------ */}

            <h3 className="mb-1">Add custom actions</h3>
            <p className="cp-text-txt-6 cp-text-sm mb-4">
                Sometimes a clinical finding may come with a list of recommended follow-up actions.
                Note that if actions are provided, a Dismiss button will still be rendered (if <code>dismiss</code> prop is provided),
                but it will be moved to the footer section.
            </p>
            <CodeBlock language="tsx">{`<FindingCard
    title="Elevated HbA1c — diabetes management review recommended"
    concernLevel="moderate"
    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
    dismiss={() => {}}
    confidenceLevel={0.75}
    actionButtons={{
        "Nephrology consult": () => alert("Nephrology consult clicked"),
        "Review vancomycin dosing": () => alert("Review vancomycin dosing clicked"),
    }}
/>`}</CodeBlock>
            <div className="mb-8">
                <FindingCard
                    title="Elevated HbA1c — diabetes management review recommended"
                    concernLevel="moderate"
                    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
                    dismiss={() => {}}
                    confidenceLevel={0.75}
                    actionButtons={{
                        "Nephrology consult": () => alert("Nephrology consult clicked"),
                        "Review vancomycin dosing": () => alert("Review vancomycin dosing clicked"),
                    }}
                />
            </div>

            {/* ------------------------------------------------------------ */}

            <h2>Evidence Tabs</h2>
            <hr className="mb-6" />

            <h3 className="mb-1">Narrative Evidence</h3>
            <p className="cp-text-txt-6 cp-text-sm mb-4">
                Unstructured narrative text can be included as evidence to provide
                additional context or explanation for the finding. This is useful
                for summarizing relevant clinical information that doesn't fit
                neatly into structured data fields. Markdown formatting is supported
                for enhanced readability.
            </p>
            <CodeBlock language="tsx">{`<FindingCard
    title="Elevated HbA1c — diabetes management review recommended"
    concernLevel="moderate"
    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
    dismiss={() => {}}
    confidenceLevel={0.75}
    actionButtons={{
        "Nephrology consult": () => alert("Nephrology consult clicked"),
        "Review vancomycin dosing": () => alert("Review vancomycin dosing clicked"),
    }}
    evidenceTabs={[
        {
            label: 'Summary', // Single tab has a label but it won't be rendered
            items: [{
                kind: 'narrative',
                text: 'Some longer text or markdown here...'
            }]
        }
    ]}
/>`}</CodeBlock>
            <div className="mb-8">
                <FindingCard
                    title="Elevated HbA1c — diabetes management review recommended"
                    concernLevel="low"
                    description="Patient's HbA1c is elevated, indicating a need for diabetes management review."
                    dismiss={() => {}}
                    confidenceLevel={0.75}
                    actionButtons={{
                        "Nephrology consult": () => alert("Nephrology consult clicked"),
                        "Review vancomycin dosing": () => alert("Review vancomycin dosing clicked"),
                    }}
                    evidenceTabs={[
                        {
                            label: 'Summary',
                            items: [{
                                kind: 'narrative',
                                text: [
                                    "Patient's **HbA1c is 9.2%** (ref <5.7%), unchanged from the reading 3 months ago. This is the second consecutive elevated result above 9%.",
                                    "**Why this matters:**\n- Sustained HbA1c ≥9% is associated with significantly increased risk of *microvascular complications* (retinopathy, nephropathy, neuropathy).\n- Current regimen (`metformin 1000 mg BID`) appears insufficient to achieve glycaemic control.\n- No documented contraindication to regimen intensification in this record.",
                                    "**Suggested next steps:**\n1. Review medication adherence and dietary history with patient\n2. Consider addition of a GLP-1 receptor agonist or SGLT-2 inhibitor\n3. Refer to diabetes nurse educator if not already engaged\n4. Repeat HbA1c in 3 months after any regimen change",
                                    "*Note: This suggestion is model-generated and should be reviewed by the treating clinician before action is taken.*",
                                ].join('\n\n')
                            }]
                        }
                    ]}
                />
            </div>



            {/* AKI – high concern, all tab types */}
            <h3 className="mb-1">High concern — AKI (Labs · Meds · Vitals · Cohort)</h3>
            <p className="cp-text-txt-6 cp-text-sm mb-4">Demonstrates lab/vital cells in a 2-column grid, medication rows with relevance tags, and a cohort statistics block.</p>
            <div className="mb-8">
                <FindingCard
                    title="Possible acute kidney injury with nephrotoxic drug exposure"
                    description="Creatinine has risen 75% over 72h while vancomycin is active. eGFR now below 35."
                    concernLevel="high"
                    confidenceLevel={0.72}
                    evidenceTabs={akiTabs}
                    actionButtons={{
                        'Nephrology consult': () => {},
                        'Review vancomycin dosing': () => {},
                    }}
                />
            </div>

            {/* Sepsis – moderate concern, SOFA score */}
            <h3 className="mb-1">Moderate concern — Sepsis (Labs · Vitals · SOFA Score)</h3>
            <p className="cp-text-txt-6 cp-text-sm mb-4">Demonstrates a structured scoring rule with component breakdown.</p>
            <div className="mb-8">
                <FindingCard
                    title="Possible sepsis — meets qSOFA + SOFA criteria"
                    description="Elevated lactate, fever, tachycardia, and leukocytosis in the context of a likely respiratory source."
                    concernLevel="moderate"
                    confidenceLevel={0.61}
                    evidenceTabs={sepsisTabs}
                    actionButtons={{
                        'Blood cultures × 2': () => {},
                        'Initiate sepsis bundle': () => {},
                    }}
                />
            </div>

            {/* DVT – low concern, imaging + notes */}
            <h3 className="mb-1">Low concern — DVT (Imaging · Risk factors · Notes)</h3>
            <p className="cp-text-txt-6 cp-text-sm mb-4">Demonstrates imaging conclusions, condition/narrative mixed tab, and document reference rows.</p>
            <div className="mb-8">
                <FindingCard
                    title="Confirmed right popliteal DVT — no pulmonary embolism on CT-PA"
                    description="Acute non-occlusive thrombus. PE excluded. Therapeutic anticoagulation recommended by vascular surgery."
                    concernLevel="low"
                    confidenceLevel={0.94}
                    evidenceTabs={dvtTabs}
                    actionButtons={{
                        'Start therapeutic anticoagulation': () => {},
                    }}
                />
            </div>

        </section>
    );
}

