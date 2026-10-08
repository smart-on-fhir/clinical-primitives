// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Observation } from 'fhir/r4';
import { analyteMatcher, assignOwners, type TimelineAnalyte } from '.';

const LOINC = 'http://loinc.org';

const reading = (id: string, text: string, coding?: { system?: string; code: string }): Observation => ({
  resourceType: 'Observation',
  id,
  status: 'final',
  code: { text, ...(coding ? { coding: [{ ...coding, display: text }] } : {}) }
});

const analytes: TimelineAnalyte[] = [
  { code: '789-8',   label: 'RBC',        keywords: ['red blood cell', 'erythrocyte', 'rbc'] },
  { code: '787-2',   label: 'MCV',        keywords: ['mcv'] },
  { code: '785-6',   label: 'MCH',        keywords: ['mch'] },
  { code: '718-7',   label: 'Hemoglobin', keywords: ['hemoglobin'] },
  { code: '1751-7',  label: 'Albumin',    keywords: ['albumin'] },
  { code: '14338-8', label: 'Prealbumin', keywords: ['prealbumin'] }
];

const ownerOf = (obs: Observation) => assignOwners(analytes, [obs]).get(obs);

describe('assignOwners', () => {
  it('gives a reading to the analyte that claims its code, over a keyword', () => {
    expect(ownerOf(reading('a', 'MCV [Entitic mean volume] in Red Blood Cells', { system: LOINC, code: '787-2' }))).toBe('787-2');
  });

  it('gives a LOINC-coded reading no analyte claims to nobody', () => {
    expect(ownerOf(reading('a', 'Hemoglobin A1c/Hemoglobin.total in Blood', { system: LOINC, code: '4548-4' }))).toBeUndefined();
  });

  it('still matches a locally coded reading by keyword', () => {
    expect(ownerOf(reading('a', 'Hemoglobin', { system: 'urn:local', code: 'HGB' }))).toBe('718-7');
  });

  it('gives an uncoded reading to the longest matching keyword', () => {
    expect(ownerOf(reading('a', 'Prealbumin'))).toBe('14338-8');
  });

  it('matches keywords as whole words', () => {
    expect(ownerOf(reading('a', 'MCHC'))).toBeUndefined();
  });

  it('breaks a keyword tie by list order', () => {
    const tied: TimelineAnalyte[] = [
      { code: 'x', label: 'X', keywords: ['iron'] },
      { code: 'y', label: 'Y', keywords: ['iron'] }
    ];
    const obs = reading('a', 'Iron');
    expect(assignOwners(tied, [obs]).get(obs)).toBe('x');
  });
});

describe('analyteMatcher', () => {
  it('asks about one analyte alone, by code or keyword', () => {
    const rbc = analyteMatcher(analytes[0]);
    expect(rbc(reading('a', 'Erythrocytes', { system: LOINC, code: '789-8' }))).toBe(true);
    expect(rbc(reading('b', 'Erythrocyte sedimentation rate', { system: LOINC, code: '4537-7' }))).toBe(true);
    expect(rbc(reading('c', 'Platelets', { system: LOINC, code: '777-3' }))).toBe(false);
  });
});
