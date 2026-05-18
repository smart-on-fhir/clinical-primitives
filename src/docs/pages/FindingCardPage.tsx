import { FindingCard } from "../../components/FindingCard";
import { CodeBlock }   from "../components/CodeBlock";


export function FindingCardPage() {
    return (
        <section className="mt-4 max-w-4xl">

            <header className="text-sky-500 uppercase mb-2">FindingCard</header>
            <p className="cp-text-txt-4 mb-6">
                A card component for displaying a single clinical finding. This component is under
                active development — props and appearance will be defined as the design evolves.
            </p>

            <hr className="mb-6" />

            {/* Usage */}
            <h3 className="mb-3">Usage</h3>
            <CodeBlock>{`import { FindingCard } from "clinical-primitives";

<FindingCard />`}</CodeBlock>

            {/* Example */}
            <h3 className="mb-4">Example</h3>
            <div className="mb-8">
                <FindingCard
                    title="Possible acute kidney injury with nephrotoxic drug exposure"
                    description="Creatinine has risen 75% over 72h while vancomycin is active. eGFR now below 35. Metformin and lisinopril were appropriately held on D2."
                    concernLevel="moderate"
                    confidenceLevel={85}
                    actionButtons={<>
                        <button className="primary">Nephrology consult</button>
                        <button>Review vancomycin dosing</button>
                    </>}
                />
            </div>

        </section>
    );
}
