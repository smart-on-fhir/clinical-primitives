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

describe('LabTrendPanel row assignment', () => {
  const local = (id: string, code: string, display: string, value: number): FhirResource => ({
    ...observation(id, code, display, value, 'x', '2024-01-01'),
    code: { coding: [{ system: 'urn:local', code, display }], text: display }
  });
  const uncoded = (id: string, display: string, value: number): FhirResource => ({
    ...observation(id, 'unused', display, value, 'x', '2024-01-01'),
    code: { text: display }
  });

  // Every one of these is coded in LOINC under a code the row doesn't list, and
  // used to land in the row through a keyword in its name.
  it.each([
    ['Hemoglobin',  '4548-4',  'Hemoglobin A1c/Hemoglobin.total in Blood'],
    ['Albumin',     '14959-1', 'Microalbumin/Creatinine [Mass Ratio] in Urine'],
    ['Lymphocytes', '26478-8', 'Lymphocytes/Leukocytes in Blood'],
    ['VitaminD',    '1649-3',  '1,25-Dihydroxyvitamin D'],
    ['Weight',      '77606-2', 'Weight-for-length Per age and sex'],
    ['BMI',         '59576-9', 'Body mass index (BMI) [Percentile] Per age and sex'],
    ['RBC',         '4537-7',  'Erythrocyte [Sedimentation Rate] in Blood by Westergren method']
  ] as const)('keeps %s free of %s (%s)', async (preset, code, display) => {
    const { container } = await renderPanel([observation('o1', code, display, 12.3, 'x', '2024-01-01')], [preset]);
    expect(container.textContent).not.toContain('12.3');
  });

  it('gives a reading to one row only, the one that claims its code', async () => {
    const { container } = await renderPanel([
      observation('esr', '4537-7', 'Erythrocyte [Sedimentation Rate] in Blood by Westergren method', 12.3, 'mm/h', '2024-01-01')
    ], ['RBC', 'ESR']);
    const rows = [...container.querySelectorAll('tr')].map(tr => tr.textContent);
    expect(rows.filter(text => text?.includes('12.3'))).toHaveLength(1);
    expect(rows.find(text => text?.includes('12.3'))).toContain('ESR');
  });

  it('still matches a locally coded reading by keyword', async () => {
    const { container } = await renderPanel([local('o1', 'CRP-LOCAL', 'CRP', 7.7)], ['CRP']);
    expect(container.textContent).toContain('7.7');
  });

  it('gives an uncoded reading to the longest matching keyword', async () => {
    const { container } = await renderPanel([uncoded('o1', 'Prealbumin', 21.5)], ['Albumin', 'PreAlbumin']);
    const row = [...container.querySelectorAll('tr')].find(tr => tr.textContent?.includes('21.5'));
    expect(row?.textContent).toContain('PreAlbumin');
  });
});

describe('LabTrendPanel computed flags', () => {
  const ranged = (obs: FhirResource, low: number, high: number) => ({ ...obs, referenceRange: [{ low: { value: low }, high: { value: high } }] });
  const hgb = (id: string, value: number, date: string) => observation(id, '718-7', 'Hemoglobin [Mass/volume] in Blood', value, 'g/dL', date);
  const flagOf = (container: HTMLElement) => container.querySelector('.lt-flag')?.textContent;

  // Hemoglobin 12–16 g/dL, no interpretation codes, so the panel grades the
  // value itself. A quarter of the range width (1 g/dL) past a bound is the
  // line between slightly and far out.
  it.each([
    [11.5, '↓'],
    [9,    '↓↓'],
    [16.5, '↑'],
    [19,   '↑↑'],
    [14,   '—']
  ])('flags %s g/dL as %s', async (value, flag) => {
    const { container } = await renderPanel([ranged(hgb('o1', value, '2024-01-01'), 12, 16)], ['Hemoglobin']);
    expect(flagOf(container)).toBe(flag);
  });

  it('points the arrow using a range borrowed from an older reading', async () => {
    const { container } = await renderPanel([
      ranged(hgb('old', 14, '2024-01-01'), 12, 16),
      hgb('new', 11.5, '2024-06-01')
    ], ['Hemoglobin']);
    expect(flagOf(container)).toBe('↓');
  });
});

describe('LabTrendPanel tooltips', () => {
  const ranged = (obs: FhirResource, low: number, high: number) => ({ ...obs, referenceRange: [{ low: { value: low }, high: { value: high } }] });
  const hgb = (id: string, value: number, date: string) => observation(id, '718-7', 'Hemoglobin [Mass/volume] in Blood', value, 'g/dL', date);
  const tip = (container: HTMLElement, selector: string) => container.querySelector(selector)?.getAttribute('data-tooltip') ?? '';

  it('explains a computed flag and the range it was judged against', async () => {
    const { container } = await renderPanel([ranged(hgb('o1', 11.5, '2024-06-01'), 12, 16)], ['Hemoglobin']);
    expect(tip(container, '.lt-flag')).toContain('**Below** the reference range (12–16 g/dL)');
    expect(tip(container, '.lt-flag')).toContain('the lab sent no interpretation code');
  });

  it('attributes an interpretation-code flag to the lab', async () => {
    const flagged = { ...hgb('o1', 18, '2024-06-01'), interpretation: [{ coding: [{ code: 'H' }] }] };
    const { container } = await renderPanel([flagged], ['Hemoglobin']);
    expect(tip(container, '.lt-flag')).toBe('**High.** Flagged by the lab (interpretation `H`).');
  });

  it("shows the latest reading's own range, and says when a range is borrowed", async () => {
    const own = await renderPanel([ranged(hgb('old', 14, '2024-01-01'), 10, 20), ranged(hgb('new', 14, '2024-06-01'), 12, 16)], ['Hemoglobin']);
    expect(own.container.querySelector('.lt-ref')?.textContent).toBe('Ref 12–16');
    expect(tip(own.container, '.lt-ref')).toContain('as reported with the latest reading');
    cleanup();

    // Mid-month, so the displayed date stays in 2024 whatever the timezone.
    const borrowed = await renderPanel([ranged(hgb('old', 14, '2024-03-15'), 12, 16), hgb('new', 14, '2024-06-15')], ['Hemoglobin']);
    expect(tip(borrowed.container, '.lt-ref')).toMatch(/borrowed from the reading of Mar 1[45], 2024/);
  });

  it('lists the tests in a row with their codes, and the previous value', async () => {
    const { container } = await renderPanel([
      observation('a', '1988-5', 'C reactive protein [Mass/volume] in Serum or Plasma', 4.2, 'mg/L', '2024-01-01'),
      observation('b', '30522-7', 'C-reactive protein, high sensitivity', 1.7, 'mg/L', '2024-06-01')
    ], ['CRP']);
    expect(tip(container, '.lt-name')).toContain('2 readings');
    expect(tip(container, '.lt-name')).toContain('`30522-7`');
    expect(tip(container, '.lt-value > div')).toBe('');
    expect(container.querySelector('[data-tooltip*="the latest reading."]')?.getAttribute('data-tooltip')).toContain('Before that: 4.2 mg/L');
  });

  it('escapes Markdown in names taken from the record', async () => {
    const { container } = await renderPanel([observation('a', 'X-1', 'CRP *stat*', 3, 'mg/L', '2024-01-01')], [{ label: 'CRP', loincs: ['X-1'] }]);
    expect(tip(container, '.lt-name')).toContain('CRP \\*stat\\*');
  });
});

