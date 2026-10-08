import { describe, expect, it } from 'vitest';
import type { Observation } from 'fhir/r4';
import { inUnitOf } from './utils';

const reading = (id: string, value: number, unit?: string, range?: { low?: number; high?: number; unit?: string }): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { text: 'x' },
  valueQuantity: { value, ...(unit ? { unit } : {}) },
  ...(range ? { referenceRange: [{
    ...(range.low  !== undefined ? { low:  { value: range.low,  ...(range.unit ? { unit: range.unit } : {}) } } : {}),
    ...(range.high !== undefined ? { high: { value: range.high, ...(range.unit ? { unit: range.unit } : {}) } } : {})
  }] } : {})
});

describe('inUnitOf', () => {
  it('rescales a reading and its reference range into the reference unit', () => {
    const latest = reading('a', 42, 'mg/L');
    const older  = reading('b', 4.2, 'mg/dL', { low: 0, high: 0.5 });

    const { observations, dropped } = inUnitOf([latest, older], latest);

    expect(observations[0]).toBe(latest);
    expect(observations[1].valueQuantity).toMatchObject({ value: 42, unit: 'mg/L' });
    expect(observations[1].referenceRange?.[0]).toMatchObject({ low: { value: 0 }, high: { value: 5 } });
    expect(dropped.count).toBe(0);
  });

  it('leaves out readings in another dimension, and counts them by unit', () => {
    const latest = reading('a', 30, 'ng/mL');

    const { observations, dropped } = inUnitOf([latest, reading('b', 75, 'nmol/L'), reading('c', 80, 'nmol/L')], latest);

    expect(observations).toEqual([latest]);
    expect(dropped).toEqual({ count: 2, units: ['nmol/L'] });
  });

  it('passes through readings with no unit, and component readings', () => {
    const latest = reading('a', 42, 'mg/L');
    const unitless = reading('b', 7);
    const bp: Observation = { resourceType: 'Observation', id: 'c', status: 'final', code: { text: 'BP' }, component: [] };

    expect(inUnitOf([latest, unitless, bp], latest).observations).toEqual([latest, unitless, bp]);
  });

  it('changes nothing when the reference has no unit', () => {
    const list = [reading('a', 1), reading('b', 4.2, 'mg/dL')];
    expect(inUnitOf(list, list[0]).observations).toBe(list);
  });
});
