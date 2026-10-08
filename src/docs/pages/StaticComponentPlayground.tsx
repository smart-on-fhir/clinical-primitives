import { useState }                   from "react";
import { Column, Row, StaticComponent } from "../..";
import { ClinicalPageHeader }          from "../components/ClinicalPageHeader";


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
            {/* `contain: size` keeps the rendered UI's content height out of the
                row's height, so the row follows the textarea (or the 20rem
                floor) and the lists inside scroll instead of growing it. */}
            <Column style={{ flex: '1 1 0', minWidth: 0, overflow: 'auto', contain: 'size', background: 'var(--bg-secondary)' }}>
                {/* Keyed so an edit remounts it: an error boundary that has
                    caught doesn't reset when `instruction` changes. */}
                <StaticComponent key={currentInstruction} instruction={currentInstruction} />
            </Column>
        </Row>
    )
}

export function Playground() {
    return (
        <section className="mt-4 max-w-8xl">
            <ClinicalPageHeader title="StaticComponent Playground" />
            <p className="cp-text-txt-4 mb-6">
                Edit the JSON instruction on the left and <code>StaticComponent</code> renders it on
                the right. Break the JSON, or use a clinical type with a bad field, and the error
                shows as a danger <code>Alert</code> in place of that instruction, while its
                siblings keep rendering. An unknown <code>type</code> renders an "Unhandled type"
                message.
            </p>
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
