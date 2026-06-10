import { useEffect, useRef, useState } from "react";
import type { Patient }                from "fhir/r4";
import { Button, Column, Row, StaticComponent, useClinicalData }     from "../..";
import { ClinicalPageHeader }          from "../components/ClinicalPageHeader";
import bundle                          from "../samplePatientBundle.json";


function ComponentDemo({ instruction }: { instruction?: string }) {
    const [currentInstruction, setCurrentInstruction] = useState<string>(instruction || '');
    return (
        <Row style={{ minHeight: '20rem', gap: '1rem' }}>
            <Column style={{ flex: '0 0 auto' }}>
                <textarea
                    className='font-monospace border rounded-lg p-2 border-stone-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50'
                    placeholder='Instruction'
                    style={{
                        resize: 'both',
                        height: '100%',
                        fontSize: '12px',
                        whiteSpace: 'pre',
                        background: 'var(--bg-secondary)',
                        minWidth: '10rem',
                    }}
                    value={currentInstruction}
                    onChange={(e) => setCurrentInstruction(e.target.value)} />
            </Column>
            <Column style={{ flex: '1 1 0', minWidth: 0, overflow: 'auto', background: 'var(--bg-secondary)' }}>
                <StaticComponent instruction={currentInstruction} />
            </Column>
        </Row>
    )
}

export function Playground() {
    return (
        <section className="mt-4 max-w-8xl">
            <ClinicalPageHeader title="SourceDialog" />
            <ComponentDemo instruction={`{
  "type": "row",
  "children": [
    {
      "type": "column",
      "style": {"flex": 2},
      "children": [{
        "type": "row",
        "style": {"flex": 2},
        "children": [
          { "type": "medication_list" }
        ]
      }, {
        "type": "row",
        "style": {"flex": 3},
        "children": [
          { "type": "medication_list" }
        ]
      }]
    },
    {
      "type": "column",
      "children": [
        { "type": "medication_list" }
      ]
    }
  ]
}`} />
        </section>
    );
}
