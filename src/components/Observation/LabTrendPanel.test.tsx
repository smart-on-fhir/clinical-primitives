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

// `display` undefined makes a code-only reading, which no keyword can match.
const observation = (id: string, code: string, display: string | undefined, value: number, unit: string, date: string): FhirResource => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: display ? { coding: [{ system: 'http://loinc.org', code, display }], text: display } : { coding: [{ system: 'http://loinc.org', code }] },
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

describe('LabTrendPanel preset codes', () => {
  // One reading per corrected code, with no display text, so only the code can
  // put it in the row.
  it.each([
    ['Calprotectin', '38445-3'],
    ['VitaminD', '62292-8'],
    ['VitaminD', '83070-3'],
    ['PreAlbumin', '14338-8'],
    ['Albumin', '61151-7'],
    ['MPV', '32623-1'],
    ['Lymphocytes', '26474-7']
  ] as const)('%s matches %s by code alone', async (preset, code) => {
    const { container } = await renderPanel([observation('o1', code, undefined, 12.3, 'x', '2024-01-01')], [preset]);
    expect(container.textContent).toContain('12.3');
  });

  it.each([
    ['PreAlbumin', '2857-1'], // prostate-specific antigen
    ['PreAlbumin', '1809-3'], // salivary amylase
    // Lymphocytes as a percentage of leukocytes. Only the code is gone: a
    // reading displayed as "Lymphocytes/Leukocytes" still matches the
    // `lymphocyte` keyword (see Known issues in AGENTS.md).
    ['Lymphocytes', '26478-8']
  ] as const)('%s no longer matches %s', async (preset, code) => {
    const { container } = await renderPanel([observation('o1', code, undefined, 12.3, 'x', '2024-01-01')], [preset]);
    expect(container.textContent).not.toContain('12.3');
  });
});

describe('LabTrendPanel units', () => {
  const withRange = (obs: FhirResource, low: number, high: number) => ({ ...obs, referenceRange: [{ low: { value: low }, high: { value: high } }] });

  it('converts an older reading\'s reference range into the row\'s unit', async () => {
    const { container } = await renderPanel([
      withRange(observation('old', '1988-5', 'CRP', 0.4, 'mg/dL', '2024-01-01'), 0, 0.5),
      observation('new', '1988-5', 'CRP', 3, 'mg/L', '2024-06-01')
    ], ['CRP']);

    expect(container.textContent).toContain('Ref 0–5');
  });

  it('says how many readings it left out, and in what unit', async () => {
    const { container } = await renderPanel([
      observation('old', '14635-7', undefined, 75, 'nmol/L', '2024-01-01'),
      observation('new', '1989-3', undefined, 30, 'ng/mL', '2024-06-01')
    ], ['VitaminD']);

    expect(container.textContent).toContain('1 in nmol/L not plotted');
  });
});

