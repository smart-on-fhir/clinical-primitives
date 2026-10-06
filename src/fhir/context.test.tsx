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

/** A promise the test resolves itself, to control the order fetches finish in. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

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

describe('getPatient() with overlapping requests', () => {
  const patientA: Patient = { resourceType: 'Patient', id: 'a' };
  const patientB: Patient = { resourceType: 'Patient', id: 'b' };

  it('fetches a different patient instead of returning the one in flight', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const a = deferred<Patient>();
    const fetchB = vi.fn(async () => patientB);

    let returned: Patient | undefined;
    await act(async () => {
      void result.current.getPatient('a', () => a.promise);
      returned = await result.current.getPatient('b', fetchB);
    });

    expect(fetchB).toHaveBeenCalledOnce();
    expect(returned).toBe(patientB);
    expect(result.current.patient).toBe(patientB);
  });

  it('does not let an older response overwrite a newer patient', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const a = deferred<Patient>();
    const b = deferred<Patient>();

    let returnedA: Promise<Patient>;
    await act(async () => {
      returnedA = result.current.getPatient('a', () => a.promise);
      const returnedB = result.current.getPatient('b', () => b.promise);
      b.resolve(patientB);
      await returnedB;
      a.resolve(patientA);
    });

    // A's caller still gets patient A; only the context is protected.
    await expect(returnedA!).resolves.toBe(patientA);
    expect(result.current.patient).toBe(patientB);
  });

  it('shares one fetch between calls for the same patient', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const a = deferred<Patient>();
    const fetchA = vi.fn(() => a.promise);

    await act(async () => {
      const first = result.current.getPatient('a', fetchA);
      const second = result.current.getPatient('a', fetchA);
      a.resolve(patientA);
      expect(await first).toBe(await second);
    });

    expect(fetchA).toHaveBeenCalledOnce();
  });

  it('writes a shared fetch when its patient is requested again last', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const a = deferred<Patient>();
    const b = deferred<Patient>();

    await act(async () => {
      void result.current.getPatient('a', () => a.promise);
      void result.current.getPatient('b', () => b.promise);
      void result.current.getPatient('a', () => a.promise);
      a.resolve(patientA);
      b.resolve(patientB);
      await Promise.all([a.promise, b.promise]);
    });

    expect(result.current.patient).toBe(patientA);
  });

  it('drops a fetch for another patient once the loaded one is requested again', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const b = deferred<Patient>();

    await act(() => result.current.getPatient('a', async () => patientA));
    await act(async () => {
      void result.current.getPatient('b', () => b.promise);
      await result.current.getPatient('a', async () => patientA);
      b.resolve(patientB);
      await b.promise;
    });

    expect(result.current.patient).toBe(patientA);
  });

  it('does not bring a patient back after clear()', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const a = deferred<Patient>();

    await act(async () => {
      const request = result.current.getPatient('a', () => a.promise);
      result.current.clear();
      a.resolve(patientA);
      await request;
    });

    expect(result.current.patient).toBeNull();
  });

  it('does not overwrite a patient set by a load', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const b = deferred<Patient>();

    await act(async () => {
      const request = result.current.getPatient('b', () => b.promise);
      await result.current.loadFromResources(record);
      b.resolve(patientB);
      await request;
    });

    expect(result.current.patient?.id).toBe('p1');
  });
});

describe('lazy() across a replacement of the record', () => {
  type Row = { resourceType: string; id: string };
  const stale: Row[] = [{ resourceType: 'Observation', id: 'stale' }];

  it('does not write after clear(), but still resolves for its caller', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const pending = deferred<Row[]>();

    let returned: Row[] | undefined;
    await act(async () => {
      const request = result.current.lazy('Observation', () => pending.promise);
      result.current.clear();
      pending.resolve(stale);
      returned = await request;
    });

    expect(returned).toBe(stale);
    expect(result.current.resources).toEqual({});
  });

  it("does not overwrite a newly loaded patient's data", async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const pending = deferred<Row[]>();

    await act(async () => {
      const request = result.current.lazy('Observation', () => pending.promise);
      await result.current.loadFromResources(record);
      pending.resolve(stale);
      await request;
    });

    expect(result.current.resources.Observation).toEqual([{ resourceType: 'Observation', id: 'o1' }]);
  });

  it('starts a fresh fetch after clear() instead of sharing the dropped one', async () => {
    const { result } = renderHook(useClinicalData, { wrapper });
    const old = deferred<Row[]>();
    const fresh = deferred<Row[]>();
    const freshRows: Row[] = [{ resourceType: 'Observation', id: 'fresh' }];
    const third = vi.fn(async () => []);

    await act(async () => {
      const oldRequest = result.current.lazy('Observation', () => old.promise);
      result.current.clear();
      const request = result.current.lazy('Observation', () => fresh.promise);

      // The old fetch landing must not drop the fresh one from the in-flight
      // list, so this third call still shares it. `force` skips the cache, so
      // only the in-flight list can keep it from fetching.
      old.resolve(stale);
      await oldRequest;
      void result.current.lazy('Observation', third, { force: true });

      fresh.resolve(freshRows);
      await request;
    });

    expect(third).not.toHaveBeenCalled();
    expect(result.current.resources.Observation).toBe(freshRows);
  });
});
