import { describe, expect, it } from 'vitest';
import { parseNdjson, resolvePatientDataSource } from './parse';

const ndjson = (...rows: object[]) => rows.map(row => JSON.stringify(row)).join('\n');

describe('parseNdjson', () => {
  it('parses one resource per line', () => {
    const resources = parseNdjson(ndjson(
      { resourceType: 'Patient', id: 'p1' },
      { resourceType: 'Observation', id: 'o1' }
    ));

    expect(resources).toEqual([
      { resourceType: 'Patient', id: 'p1' },
      { resourceType: 'Observation', id: 'o1' }
    ]);
  });

  it('skips blank lines and accepts CRLF line endings', () => {
    const text = '\r\n{"resourceType":"Patient","id":"p1"}\r\n   \r\n{"resourceType":"Observation","id":"o1"}\r\n';
    expect(parseNdjson(text)).toHaveLength(2);
  });

  it('throws with the line number for a row that is not a resource', () => {
    const text = '{"resourceType":"Patient","id":"p1"}\n{"foo":"bar"}';
    expect(() => parseNdjson(text)).toThrow('NDJSON line 2 is not a FHIR resource object.');
  });

  it('counts blank lines when reporting the line number', () => {
    const text = '{"resourceType":"Patient","id":"p1"}\n\n{"resourceType":"Observation"}';
    expect(() => parseNdjson(text)).toThrow(/^NDJSON line 3 /);
  });

  it.each([
    ['missing', {}],
    ['empty', { id: '' }],
    ['not a string', { id: 42 }]
  ])('throws when the id is %s', (_, idField) => {
    const text = ndjson({ resourceType: 'Observation', ...idField });
    expect(() => parseNdjson(text)).toThrow(
      'NDJSON line 1 has resourceType "Observation" but no id. Is a non-FHIR file mixed in?'
    );
  });
});

describe('resolvePatientDataSource with NDJSON', () => {
  it('rejects a provenance sidecar concatenated with the real data', async () => {
    // Sidecar rows reuse resourceType but carry resourceId instead of id.
    // Before the id check these loaded and failed later as "multiple distinct patients".
    const text = ndjson(
      { resourceType: 'Patient', id: 'p1' },
      { fullUrl: 'urn:uuid:p1', resourceId: 'p1', resourceType: 'Patient' }
    );

    await expect(resolvePatientDataSource({ type: 'ndjson', ndjson: text })).rejects.toThrow(
      'NDJSON line 2 has resourceType "Patient" but no id.'
    );
  });
});
