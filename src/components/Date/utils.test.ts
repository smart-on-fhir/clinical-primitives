import { describe, expect, it } from 'vitest';
import { formatFhirDate, formatFhirDateTime, parseFhirDateLocal } from './utils';

describe('test environment', () => {
  it('runs west of UTC, where the date-only bug would show', () => {
    expect(new Date('2024-01-01').getDate()).toBe(31);
  });
});

describe('formatFhirDate', () => {
  it('shows a date-only value as the day it names', () => {
    expect(formatFhirDate('2024-01-01')).toBe('Jan 1, 2024');
  });

  it('shows partial dates at their own precision', () => {
    expect(formatFhirDate('2024-03')).toBe('Mar 2024');
    expect(formatFhirDate('2019')).toBe('2019');
  });

  it('shows a dateTime in local time', () => {
    // 02:00 UTC on Jan 1 is still Dec 31 in New York.
    expect(formatFhirDate('2024-01-01T02:00:00Z')).toBe('Dec 31, 2023');
  });

  it('treats a Date at exactly UTC midnight as date-only', () => {
    expect(formatFhirDate(new Date('2024-01-01'))).toBe('Jan 1, 2024');
  });

  it('honors the requested fields', () => {
    expect(formatFhirDate('2024-01-01', { year: '2-digit', month: '2-digit', day: '2-digit' })).toBe('01/01/24');
  });

  it('returns a dash for nothing and an unparseable string as given', () => {
    expect(formatFhirDate(undefined)).toBe('—');
    expect(formatFhirDate('sometime')).toBe('sometime');
  });
});

describe('formatFhirDateTime', () => {
  it('adds the local time of day to a dateTime', () => {
    // 19:30 UTC is 2:30 PM in New York.
    expect(formatFhirDateTime('2024-01-01T19:30:00Z')).toBe('Jan 1, 2024, 2:30 PM');
    expect(formatFhirDateTime(new Date('2024-01-01T19:30:00Z'))).toBe('Jan 1, 2024, 2:30 PM');
  });

  it('shows a date-only value as a date, with no invented time', () => {
    expect(formatFhirDateTime('2024-01-01')).toBe('Jan 1, 2024');
    expect(formatFhirDateTime('2024-03')).toBe('Mar 2024');
    expect(formatFhirDateTime(new Date('2024-01-01'))).toBe('Jan 1, 2024');
  });

  it('returns a dash for nothing and an unparseable string as given', () => {
    expect(formatFhirDateTime(undefined)).toBe('—');
    expect(formatFhirDateTime('sometime')).toBe('sometime');
  });
});

describe('parseFhirDateLocal', () => {
  it('gives local midnight of the day a date-only value names', () => {
    const date = parseFhirDateLocal('2024-01-01')!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2024, 0, 1, 0]);
  });

  it('parses a dateTime as an instant', () => {
    expect(parseFhirDateLocal('2024-01-01T02:00:00Z')!.toISOString()).toBe('2024-01-01T02:00:00.000Z');
  });
});
