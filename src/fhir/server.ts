import type { FhirBundle, FhirResource } from './types';
import { bundleToResources } from './parse';

export interface FetchEverythingOptions {
    throttleMs?: number;
    retries?: number;
    retryDelayMs?: number;
    count?: number;
    signal?: AbortSignal;
}

function getNextUrl(bundle: FhirBundle): string | null {
    const links = bundle.link as Array<{ relation: string; url: string }> | undefined;
    return links?.find(l => l.relation === 'next')?.url ?? null;
}

/**
 * Client errors that ask to try again later, so they're retried like 5xx:
 * 408 Request Timeout and 429 Too Many Requests.
 */
const RETRYABLE_CLIENT_ERRORS = new Set([408, 429]);

const abortError = () => new DOMException('Aborted', 'AbortError');

/** Waits `ms`, but rejects with an AbortError as soon as `signal` aborts. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());

        const onAbort = () => {
            clearTimeout(timer);
            reject(abortError());
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);

        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

async function fetchWithRetry(
    url: string,
    signal: AbortSignal | undefined,
    retries: number,
    retryDelayMs: number
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        if (signal?.aborted) throw abortError();

        if (attempt > 0) {
            await sleep(retryDelayMs * 2 ** (attempt - 1), signal);
        }

        let response: Response;
        try {
            response = await fetch(url, {
                signal,
                headers: { Accept: 'application/fhir+json' },
            });
        } catch (err) {
            // Checked on the signal, not the error: fetch rejects with the
            // signal's reason, which needn't be a DOMException.
            if (signal?.aborted) throw err;
            lastError = err instanceof Error ? err : new Error(String(err));
            continue;
        }

        if (response.ok) return response;

        const error = new Error(`FHIR server error: ${response.status} ${response.statusText}`);

        // Other client errors won't change on a retry, so they fail at once.
        if (response.status < 500 && !RETRYABLE_CLIENT_ERRORS.has(response.status)) throw error;

        lastError = error;
    }

    throw lastError!;
}

export async function fetchPatientEverything(
    baseUrl: string,
    patientId: string,
    onPage: (resources: FhirResource[]) => void,
    options: FetchEverythingOptions = {}
): Promise<void> {
    const { throttleMs = 500, retries = 3, retryDelayMs = 1000, count = 200, signal } = options;
    const base = baseUrl.replace(/\/$/, '');
    let url: string | null = `${base}/Patient/${encodeURIComponent(patientId)}/$everything?_count=${count}`;

    while (url) {
        const response = await fetchWithRetry(url, signal, retries, retryDelayMs);
        const bundle = (await response.json()) as FhirBundle;
        const resources = bundleToResources(bundle);
        if (resources.length > 0) {
            onPage(resources);
        }

        url = getNextUrl(bundle);
        if (url && throttleMs > 0) {
            await sleep(throttleMs, signal);
        }
    }
}
