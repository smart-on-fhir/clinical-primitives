// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClinicalDataProvider, useClinicalData } from '../../fhir/context';
import type { FhirResource } from '../../fhir/types';
import { ObservationsPanel } from './ObservationsPanel';

afterEach(cleanup);

// jsdom has no ResizeObserver; the cards' sparklines use it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const observation = (id: string, code: string, display: string, value: number, unit: string): FhirResource => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code, display }], text: display },
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: '2024-01-01',
  valueQuantity: { value, unit }
});

function Loaded({ resources, children }: { resources: FhirResource[]; children: ReactNode }) {
  const { loadFromResources, patient } = useClinicalData();
  useEffect(() => { loadFromResources(resources); }, [loadFromResources, resources]);
  return patient ? children : null;
}

async function renderIbdPanel(observations: FhirResource[]) {
  const resources = [{ resourceType: 'Patient', id: 'p1' }, ...observations];
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <ClinicalDataProvider>
        <Loaded resources={resources}><ObservationsPanel filters={['IBD']} /></Loaded>
      </ClinicalDataProvider>
    );
  });
  return view;
}

describe('ObservationsPanel IBD filter', () => {
  // The filter needs a preset code *and* a preset keyword, so a reading coded
  // outside the presets is dropped whatever its display says.
  // Cards shorten the display text, so these check for the analyte's name.
  it.each([
    ['38445-3', 'Calprotectin [Mass/mass] in Stool', 'Calprotectin'],
    ['62292-8', '25-Hydroxyvitamin D3+25-Hydroxyvitamin D2 [Mass/volume] in Serum or Plasma', '25-Hydroxyvitamin']
  ])('includes %s', async (code, display, name) => {
    const { container } = await renderIbdPanel([observation('o1', code, display, 12.3, 'x')]);
    expect(container.textContent).toContain(name);
  });

  it('leaves out urine microalbumin/creatinine (14959-1)', async () => {
    const { container } = await renderIbdPanel([observation('o1', '14959-1', 'Microalbumin Creatinine Ratio', 12.3, 'mg/g')]);
    expect(container.textContent).not.toContain('Microalbumin');
  });
});
