import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPatientEverything } from './server';
import type { FhirBundle } from './types';

afterEach(() => {
  vi.unstubAllGlobals();
});

const bundle = (ids: string[], next?: string): FhirBundle => ({
  resourceType: 'Bundle',
  entry: ids.map(id => ({ resource: { resourceType: 'Observation', id } })),
  ...(next ? { link: [{ relation: 'next', url: next }] } : {})
});

const ok = (body: FhirBundle) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });
const failure = (status: number, statusText: string) => ({ ok: false, status, statusText, json: async () => ({}) });
const serverError = failure(503, 'Service Unavailable');

// Long enough that a test only finishes in time if the wait is cut short.
const LONG = 60_000;

describe('fetchPatientEverything', () => {
  it('follows next links and delivers each page', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(ok(bundle(['o1'], 'http://x/page2')))
      .mockResolvedValueOnce(ok(bundle(['o2'])));
    vi.stubGlobal('fetch', fetch);

    const pages: string[][] = [];
    await fetchPatientEverything('http://x/', 'p1', page => pages.push(page.map(r => r.id!)), { throttleMs: 0 });

    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      'http://x/Patient/p1/$everything?_count=200',
      'http://x/page2'
    ]);
    expect(pages).toEqual([['o1'], ['o2']]);
  });

  it('rejects as soon as it is aborted during the pause between pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(bundle(['o1'], 'http://x/page2'))));
    const controller = new AbortController();

    const request = fetchPatientEverything('http://x', 'p1', () => {
      setTimeout(() => controller.abort(), 10);
    }, { throttleMs: LONG, signal: controller.signal });

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects as soon as it is aborted during a retry backoff', async () => {
    const fetch = vi.fn().mockResolvedValue(serverError);
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);

    const request = fetchPatientEverything('http://x', 'p1', () => {}, {
      retryDelayMs: LONG,
      signal: controller.signal
    });

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('fails at once on a client error, without retrying', async () => {
    const fetch = vi.fn().mockResolvedValue(failure(404, 'Not Found'));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchPatientEverything('http://x', 'p1', () => {}, { retryDelayMs: LONG }))
      .rejects.toThrow('FHIR server error: 404 Not Found');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    [503, 'Service Unavailable'],
    [408, 'Request Timeout'],
    [429, 'Too Many Requests']
  ])('retries a %i', async (status, statusText) => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(failure(status, statusText))
      .mockResolvedValueOnce(ok(bundle(['o1'])));
    vi.stubGlobal('fetch', fetch);

    const pages: string[][] = [];
    await fetchPatientEverything('http://x', 'p1', page => pages.push(page.map(r => r.id!)), { retryDelayMs: 1 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(pages).toEqual([['o1']]);
  });

  it('rejects with the last error once retries run out', async () => {
    const fetch = vi.fn().mockResolvedValue(serverError);
    vi.stubGlobal('fetch', fetch);

    await expect(fetchPatientEverything('http://x', 'p1', () => {}, { retries: 2, retryDelayMs: 1 }))
      .rejects.toThrow('FHIR server error: 503 Service Unavailable');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
