import { useClinicalData } from "../../index";
import type { Patient } from "fhir/r4";


export function ClinicalPageHeader({ title }: { title: string }) {
    const { selectFile, patient } = useClinicalData();
    const pt = patient as Patient | null;

    return (
        <>
            <header className="text-sky-500 uppercase mb-2">{title}</header>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={selectFile}>Select Patient Bundle</button>
                { pt
                    ? <span className="text-sm cp-text-txt-4">
                        Patient: <strong>{
                            [pt.name?.[0]?.given?.join(' '), pt.name?.[0]?.family]
                                .filter(Boolean).join(' ') || pt.id
                        }</strong>
                      </span>
                    : <span className="text-sm cp-text-txt-4">
                        Using sample data · upload a <code>.json</code> or <code>.ndjson</code> bundle to preview with your own patient
                      </span>
                }
            </div>
            <hr className="mb-6" />
        </>
    );
}
