// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClinicalDataProvider, useClinicalData } from '../../fhir/context';
import type { FhirResource } from '../../fhir/types';
import { LabTrendPanel } from './LabTrendPanel';

afterEach(cleanup);

// jsdom has no ResizeObserver; the panel only uses it for its hover crosshair.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const observation = (id: string, code: string, display: string, value: number, unit: string, date: string): FhirResource => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code, display }], text: display },
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: date,
  valueQuantity: { value, unit }
});

function Loaded({ resources, children }: { resources: FhirResource[]; children: ReactNode }) {
  const { loadFromResources, patient } = useClinicalData();
  useEffect(() => { loadFromResources(resources); }, [loadFromResources, resources]);
  return patient ? children : null;
}

async function renderPanel(observations: FhirResource[], labs: Parameters<typeof LabTrendPanel>[0]['labs']) {
  const resources = [{ resourceType: 'Patient', id: 'p1' }, ...observations];
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <ClinicalDataProvider>
        <Loaded resources={resources}><LabTrendPanel labs={labs} /></Loaded>
      </ClinicalDataProvider>
    );
  });
  return view;
}

describe('LabTrendPanel CRP preset', () => {
  it('leaves out urine microalbumin/creatinine (14959-1)', async () => {
    // The microalbumin reading is the newest, so it would be the row's latest
    // value if the preset still matched it.
    const { container } = await renderPanel([
      observation('crp', '1988-5', 'C reactive protein [Mass/volume] in Serum or Plasma', 4.2, 'mg/L', '2024-01-01'),
      observation('malb', '14959-1', 'Microalbumin Creatinine Ratio', 99.9, 'mg/g', '2024-06-01')
    ], ['CRP']);

    expect(container.textContent).toContain('4.2');
    expect(container.textContent).not.toContain('99.9');
  });

  it('includes hs-CRP (30522-7) by its code', async () => {
    // Hyphenated, so neither preset keyword matches: only the code can.
    const { container } = await renderPanel([
      observation('crp', '1988-5', 'C reactive protein [Mass/volume] in Serum or Plasma', 4.2, 'mg/L', '2024-01-01'),
      observation('hscrp', '30522-7', 'C-reactive protein, high sensitivity', 1.7, 'mg/L', '2024-06-01')
    ], ['CRP']);

    expect(container.textContent).toContain('1.7');
  });
});
