import { describe, expect, it } from 'vitest';
import { calcAge } from './Patient';

describe('calcAge', () => {
  it("doesn't count a birthday a day early west of UTC", () => {
    // The evening before the 10th birthday, local time.
    const patient = { resourceType: 'Patient' as const, birthDate: '2000-06-15', deceasedDateTime: '2010-06-14T23:00:00-04:00' };
    expect(calcAge(patient)).toEqual({ age: 9, unit: 'years' });
  });

  it('counts the birthday itself', () => {
    const patient = { resourceType: 'Patient' as const, birthDate: '2000-06-15', deceasedDateTime: '2010-06-15' };
    expect(calcAge(patient)).toEqual({ age: 10, unit: 'years' });
  });
});
