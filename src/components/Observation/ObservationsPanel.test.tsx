// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
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

async function renderPanel(filters: ComponentProps<typeof ObservationsPanel>['filters'], observations: FhirResource[]) {
  const resources = [{ resourceType: 'Patient', id: 'p1' }, ...observations];
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <ClinicalDataProvider>
        <Loaded resources={resources}><ObservationsPanel filters={filters} /></Loaded>
      </ClinicalDataProvider>
    );
  });
  return view;
}

const renderIbdPanel = (observations: FhirResource[]) => renderPanel(['IBD'], observations);

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

describe('ObservationsPanel order toggle', () => {
  // A reading in a category, dated, with an optional reference range.
  const reading = (id: string, category: string, name: string, date: string, value: number, range?: [number, number]): FhirResource => ({
    resourceType: 'Observation',
    id,
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: category }] }],
    code: { text: name },
    subject: { reference: 'Patient/p1' },
    effectiveDateTime: date,
    valueQuantity: { value, unit: 'mg/dL' },
    ...(range ? { referenceRange: [{ low: { value: range[0] }, high: { value: range[1] } }] } : {})
  });

  // Labs: a normal reading newer than an out-of-range one, so the two orders
  // differ. Vitals: no ranges, so every card has no status.
  const mixed = [
    reading('l1', 'laboratory', 'Sodium', '2024-02-01', 140, [135, 145]),
    reading('l2', 'laboratory', 'Potassium', '2024-01-01', 9, [3.5, 5]),
    reading('v1', 'vital-signs', 'Weight', '2024-02-01', 70),
    reading('v2', 'vital-signs', 'Height', '2024-01-01', 170)
  ];

  const statusButton = () => screen.getByRole('button', { name: 'Status' }) as HTMLButtonElement;
  const cardOrder = (...names: string[]) => {
    // The panel's own `hidden` prop overrides TabContents', so find the active one by class.
    const text = document.querySelector('.cp-tab-contents--active')!.textContent!;
    return names.map(name => text.indexOf(name));
  };

  it('is hidden when no reading has a status', async () => {
    await renderPanel(['Labs', 'Vitals'], mixed.slice(2));
    expect(screen.queryByText('Order:')).toBeNull();
  });

  it('is hidden when every reading has the same status', async () => {
    await renderPanel(['Labs'], [
      reading('l1', 'laboratory', 'Sodium', '2024-02-01', 140, [135, 145]),
      reading('l2', 'laboratory', 'Chloride', '2024-01-01', 100, [98, 107])
    ]);
    expect(screen.queryByText('Order:')).toBeNull();
  });

  it('sorts by status where statuses differ', async () => {
    await renderPanel(['Labs', 'Vitals'], mixed);
    const [sodium, potassium] = cardOrder('Sodium', 'Potassium');
    expect(sodium).toBeLessThan(potassium);

    expect(statusButton().disabled).toBe(false);
    fireEvent.click(statusButton());

    const [sodiumAfter, potassiumAfter] = cardOrder('Sodium', 'Potassium');
    expect(potassiumAfter).toBeLessThan(sodiumAfter);
  });

  it('disables Status on a tab where it changes nothing, and keeps the choice for the others', async () => {
    await renderPanel(['Labs', 'Vitals'], mixed);
    fireEvent.click(statusButton());

    fireEvent.click(screen.getByRole('tab', { name: /Vitals/ }));
    expect(statusButton().disabled).toBe(true);
    expect(statusButton().className).toContain('cp-button--virtual');
    expect(screen.getByRole('button', { name: 'Date' }).className).not.toContain('cp-button--virtual');

    fireEvent.click(screen.getByRole('tab', { name: /Labs/ }));
    expect(statusButton().disabled).toBe(false);
    const [sodium, potassium] = cardOrder('Sodium', 'Potassium');
    expect(potassium).toBeLessThan(sodium);
  });
});
