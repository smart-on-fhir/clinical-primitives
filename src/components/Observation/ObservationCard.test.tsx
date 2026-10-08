// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Observation } from 'fhir/r4';
import { ClinicalDataProvider } from '../../fhir/context';
import { ObservationCard } from '.';

afterEach(cleanup);

// jsdom has no ResizeObserver; the sparkline uses it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const crp = (id: string, value: number, unit: string, date: string): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code: '1988-5', display: 'CRP' }], text: 'CRP' },
  effectiveDateTime: date,
  valueQuantity: { value, unit }
});

describe('ObservationCard units', () => {
  it('compares against a previous reading in another unit after converting it', async () => {
    const previous = crp('old', 3, 'mg/dL', '2024-01-01'); // 30 mg/L
    const latest   = crp('new', 42, 'mg/L', '2024-06-01');

    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <ClinicalDataProvider><ObservationCard observation={latest} history={[previous, latest]} /></ClinicalDataProvider>
      ));
    });

    // Raw values would read +39.
    expect(container.textContent).toContain('+12 mg/L');
  });
});

describe('ObservationCard date', () => {
  it('shows a date-only reading on the day it names, west of UTC too', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <ClinicalDataProvider><ObservationCard observation={crp('a', 4, 'mg/L', '2024-01-01')} /></ClinicalDataProvider>
      ));
    });
    expect(container.querySelector('.vital-date')?.textContent).toBe('01/01/24');
  });
});

