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

async function fetchWithRetry(
    url: string,
    signal: AbortSignal | undefined,
    retries: number,
    retryDelayMs: number
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        if (attempt > 0) {
            const delay = retryDelayMs * 2 ** (attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
            const response = await fetch(url, {
                signal,
                headers: { Accept: 'application/fhir+json' },
            });

            if (response.ok) return response;

            // Don't retry client errors (4xx) — only server errors (5xx)
            if (response.status < 500) {
                throw new Error(`FHIR server error: ${response.status} ${response.statusText}`);
            }

            lastError = new Error(`FHIR server error: ${response.status} ${response.statusText}`);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') throw err;
            lastError = err instanceof Error ? err : new Error(String(err));
        }
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
            await new Promise(resolve => setTimeout(resolve, throttleMs));
        }
    }
}
