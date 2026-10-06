// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useEffect, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Patient } from 'fhir/r4';
import { ClinicalDataProvider, useClinicalData, type ClinicalDataContextValue } from './context';
import type { FhirResource } from './types';

afterEach(cleanup);

const wrapper = ({ children }: PropsWithChildren) => <ClinicalDataProvider>{children}</ClinicalDataProvider>;

const record: FhirResource[] = [
  { resourceType: 'Patient', id: 'p1' },
  { resourceType: 'Observation', id: 'o1' }
];

const functionNames = [
  'loadFromBundle',
  'loadFromBundleFile',
  'loadFromResources',
  'loadFromNdjson',
  'loadFromNdjsonFile',
  'loadFromFHIRServer',
  'lazy',
  'getPatient',
  'selectFile',
  'clear'
] as const satisfies readonly (keyof ClinicalDataContextValue)[];

describe('ClinicalDataProvider', () => {
  it('keeps every function stable across a load', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const before = { ...result.current };

    await act(() => result.current.loadFromResources(record));

    expect(result.current.patient?.id).toBe('p1');
    for (const name of functionNames) {
      expect(result.current[name], name).toBe(before[name]);
    }
  });

  it('runs an effect that lists a loader as a dependency only once', async () => {
    let runs = 0;

    function Loader() {
      const { loadFromResources, patient } = useClinicalData();
      useEffect(() => {
        runs++;
        loadFromResources(record);
      }, [loadFromResources]);
      return <span>{patient?.id}</span>;
    }

    const { findByText } = render(<Loader />, { wrapper });

    await findByText('p1');
    expect(runs).toBe(1);
  });

  it('keeps the context value when the provider re-renders with no data change', () => {
    const { result, rerender } = renderHook(useClinicalData, { wrapper });
    const before = result.current;

    rerender();

    expect(result.current).toBe(before);
  });

  it('lazy() serves a just-fetched type from cache before the next render', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const observations = [{ resourceType: 'Observation', id: 'o1' }];
    const first = vi.fn(async () => observations);
    const second = vi.fn(async () => []);

    // Both calls in one act(): React doesn't re-render between them, so the
    // second call can only hit the cache through the ref.
    let cached: unknown;
    await act(async () => {
      await result.current.lazy('Observation', first);
      cached = await result.current.lazy('Observation', second);
    });

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(cached).toBe(observations);
    expect(result.current.resources.Observation).toBe(observations);
  });

  it('lazy() refetches with force', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const fresh = [{ resourceType: 'Observation', id: 'o2' }];

    await act(() => result.current.lazy('Observation', async () => [{ resourceType: 'Observation', id: 'o1' }]));
    await act(() => result.current.lazy('Observation', async () => fresh, { force: true }));

    expect(result.current.resources.Observation).toBe(fresh);
  });

  it('getPatient() sees a patient fetched by an earlier call before the next render', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const patient: Patient = { resourceType: 'Patient', id: 'p1' };
    const first = vi.fn(async () => patient);
    const second = vi.fn(async () => patient);

    let returned: Patient | undefined;
    await act(async () => {
      await result.current.getPatient('p1', first);
      returned = await result.current.getPatient('p1', second);
    });

    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(returned).toBe(patient);
  });

  it('getPatient() returns the loaded patient without fetching', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const fetcher = vi.fn(async (): Promise<Patient> => ({ resourceType: 'Patient', id: 'p1' }));

    await act(() => result.current.loadFromResources(record));
    const patient = await result.current.getPatient('p1', fetcher);

    expect(fetcher).not.toHaveBeenCalled();
    expect(patient).toBe(result.current.patient);
  });

  it('clear() empties the data', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });

    await act(() => result.current.loadFromResources(record));
    act(() => result.current.clear());

    expect(result.current.patient).toBeNull();
    expect(result.current.resources).toEqual({});
  });
});

describe('selectFile()', () => {
  const fileInput = () => document.querySelector<HTMLInputElement>('input[data-cp-file-input]')!;

  function choose(file?: File) {
    Object.defineProperty(fileInput(), 'files', { value: file ? [file] : [], configurable: true });
    fileInput().dispatchEvent(new Event('change'));
  }

  const cancel = () => fileInput().dispatchEvent(new Event('cancel'));

  const ndjsonFile = (text: string) => new File([text], 'record.ndjson');
  const validRecord = record.map(row => JSON.stringify(row)).join('\n');

  it('resolves with the patient from the chosen file', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });

    let patient: Patient | null = null;
    await act(async () => {
      const selection = result.current.selectFile();
      choose(ndjsonFile(validRecord));
      patient = await selection;
    });

    expect(patient).toMatchObject({ id: 'p1' });
    expect(result.current.patient?.id).toBe('p1');
  });

  it('rejects when the file fails to load, and sets error', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });

    await act(async () => {
      const selection = result.current.selectFile();
      choose(ndjsonFile('{"resourceType":"Patient"}'));
      await expect(selection).rejects.toThrow('NDJSON line 1 has resourceType "Patient" but no id.');
    });

    expect(result.current.error?.message).toMatch(/^NDJSON line 1 /);
  });

  it('resolves null when the picker is cancelled', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });

    const selection = result.current.selectFile();
    cancel();

    await expect(selection).resolves.toBeNull();
  });

  it('resolves null when change fires with no file', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });

    const selection = result.current.selectFile();
    choose();

    await expect(selection).resolves.toBeNull();
  });

  it('resolves an earlier call with null when a later call takes over the picker', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });

    const first = result.current.selectFile();
    const second = result.current.selectFile();

    await expect(first).resolves.toBeNull();

    cancel();
    await expect(second).resolves.toBeNull();
  });
});
