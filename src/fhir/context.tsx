import { mergeResourcesByType, resolvePatientDataSource, resourcesToPatientDataSet } from './parse';
import { fetchPatientEverything, type FetchEverythingOptions } from './server';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren
} from 'react';
import type {
    FhirBundle,
    FhirResource,
    PatientDataSet,
    PatientDataSource,
    PatientResource,
    ResourcesByType
} from './types';
import { Patient } from 'fhir/r4';

// --- Singleton file input (one per page regardless of how many providers) ---

/** Marks the input as ours, so a stale one can be found and cleared. */
const FILE_INPUT_ATTR = 'data-cp-file-input';

let _sharedInput: HTMLInputElement | null = null;

/** The selectFile() call waiting on the picker. There's one picker, so at most one. */
type PendingSelection = {
    onFile  : (file: File) => void;
    onCancel: () => void;
};

let _pendingSelection: PendingSelection | null = null;

function takePendingSelection(): PendingSelection | null {
    const pending = _pendingSelection;
    _pendingSelection = null;
    return pending;
}

function getSharedInput(): HTMLInputElement {
    if (!_sharedInput) {
        // The module variable is only half the guard: it resets whenever this
        // module is re-evaluated, which a dev server does on every hot update
        // of a linked package. The input it created is still in the body
        // though, so without this sweep each reload leaves another one behind.
        //
        // Swept rather than adopted. A stale input's `change` listener closes
        // over the previous module instance's `_pendingSelection`, so reusing
        // the element would give us a picker whose file never reaches the
        // caller waiting on it.
        document.querySelectorAll(`input[${FILE_INPUT_ATTR}]`).forEach(stale => stale.remove());

        _sharedInput = document.createElement('input');
        _sharedInput.type = 'file';
        _sharedInput.accept = '.json,.ndjson';
        _sharedInput.style.display = 'none';
        _sharedInput.setAttribute(FILE_INPUT_ATTR, '');
        _sharedInput.addEventListener('change', () => {
            const file = _sharedInput?.files?.[0];
            const pending = takePendingSelection();
            if (_sharedInput) _sharedInput.value = '';
            if (file) pending?.onFile(file);
            else pending?.onCancel();
        });
        // Fired when the user dismisses the picker. Browsers that predate the
        // event (Safari before 16.4) give no signal, and the promise stays
        // pending there until the next selectFile() call settles it.
        _sharedInput.addEventListener('cancel', () => takePendingSelection()?.onCancel());
        document.body.appendChild(_sharedInput);
    }
    return _sharedInput;
}

// ---------------------------------------------------------------------------

export type ClinicalDataContextValue = {
    patient              : Patient | null;
    resources            : ResourcesByType;
    isLoading            : boolean;
    error                : Error | null;
    loadFromBundle       : (bundle: FhirBundle) => Promise<PatientDataSet>;
    loadFromBundleFile   : (file: File) => Promise<PatientDataSet>;
    loadFromResources    : (resources: FhirResource[]) => Promise<PatientDataSet>;
    loadFromNdjson       : (ndjson: string) => Promise<PatientDataSet>;
    loadFromNdjsonFile   : (file: File) => Promise<PatientDataSet>;
    loadFromFHIRServer   : (baseUrl: string, patientId: string, options?: FetchEverythingOptions) => Promise<PatientDataSet>;
    // Constrained to { resourceType } rather than FhirResource: strictly-typed
    // resources (e.g. fhir/r4's Observation) have no index signature, so they
    // don't structurally satisfy FhirObject even though they're valid FHIR.
    lazy                 : <T extends { resourceType: string }>(resourceType: string, fetcher: () => Promise<T[]>, options?: { force?: boolean }) => Promise<T[]>;
    getPatient           : (id: string, fetcher: () => Promise<Patient>) => Promise<Patient>;
    selectFile           : () => Promise<Patient | null>;
    clear                : () => void;
};

const ClinicalDataContext = createContext<ClinicalDataContextValue | null>(null);

/**
 * useState plus a ref that always holds the latest value. The setter writes
 * the ref synchronously, so a stable callback can read the current value
 * through the ref without waiting for the next render. Every write must go
 * through the returned setter for the ref to stay accurate.
 */
function useStateWithRef<T>(initial: T) {
    const [state, setState] = useState(initial);
    const ref = useRef(initial);

    const set = useCallback((next: T | ((prev: T) => T)) => {
        ref.current = typeof next === 'function' ? (next as (prev: T) => T)(ref.current) : next;
        setState(ref.current);
    }, []);

    return [state, set, ref] as const;
}

// Every function returned here is stable for the life of the provider: they
// call only setters, and read `patient`/`resources` through refs. A fresh
// function per render would re-run any consumer effect that lists it as a
// dependency, and since each of them sets state, that effect would loop.
function useClinicalDataState() {
    const [patient  , setPatient  , patientRef  ] = useStateWithRef<Patient | null>(null);
    const [resources, setResources, resourcesRef] = useStateWithRef<ResourcesByType>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error    , setError    ] = useState<Error | null>(null);

    const load = useCallback(async (source: PatientDataSource) => {
        setIsLoading(true);
        setError(null);

        try {
            const dataSet = await resolvePatientDataSource(source);
            setPatient(dataSet.patient);
            setResources(dataSet.resources);
            return dataSet;
        } catch (loadError) {
            const normalizedError = loadError instanceof Error ?
                loadError :
                new Error('Failed to load patient data.');
            setError(normalizedError);
            throw normalizedError;
        } finally {
            setIsLoading(false);
        }
    }, [setPatient, setResources]);

    const loadFromFHIRServer = useCallback(async (baseUrl: string, patientId: string, options?: FetchEverythingOptions) => {
        setIsLoading(true);
        setError(null);
        setPatient(null);
        setResources({});

        const accumulated: FhirResource[] = [];

        try {
            await fetchPatientEverything(baseUrl, patientId, (pageResources) => {
                accumulated.push(...pageResources);
                setResources(prev => mergeResourcesByType(prev, pageResources));
                const pagePatient = pageResources.find(r => r.resourceType === 'Patient');
                if (pagePatient) setPatient(pagePatient as PatientResource);
            }, options);

            return resourcesToPatientDataSet(accumulated);
        } catch (loadError) {
            const normalizedError = loadError instanceof Error ?
                loadError :
                new Error('Failed to load patient data from FHIR server.');
            setError(normalizedError);
            throw normalizedError;
        } finally {
            setIsLoading(false);
        }
    }, [setPatient, setResources]);

    // In-flight lazy() fetches, keyed by resourceType, so overlapping callers
    // (e.g. two components mounting in the same render pass) share one fetch
    // instead of each triggering their own.
    const pendingLazyLoads = useRef<Record<string, Promise<unknown[]>>>({});

    const lazy = useCallback(async <T extends { resourceType: string }>(
        resourceType: string,
        fetcher: () => Promise<T[]>,
        options?: { force?: boolean }
    ): Promise<T[]> => {
        // An in-flight fetch is shared regardless of `force`: a second forced
        // call while one is already running should ride along, not start a
        // redundant fetch of its own.
        const pending = pendingLazyLoads.current[resourceType];
        if (pending) return pending as Promise<T[]>;

        if (!options?.force) {
            const cached = resourcesRef.current[resourceType];
            if (cached) return cached as unknown as T[];
        }

        const promise = fetcher()
            .then(fetched => {
                setResources(prev => ({ ...prev, [resourceType]: fetched as unknown as FhirResource[] }));
                return fetched;
            })
            .finally(() => {
                delete pendingLazyLoads.current[resourceType];
            });

        pendingLazyLoads.current[resourceType] = promise;
        return promise;
    }, [setResources, resourcesRef]);

    // In-flight getPatient() fetch, so overlapping callers share one request.
    const pendingPatientLoad = useRef<Promise<Patient> | null>(null);

    const getPatient = useCallback(async (id: string, fetcher: () => Promise<Patient>): Promise<Patient> => {
        const current = patientRef.current;
        if (current && current.id === id) return current;

        if (pendingPatientLoad.current) return pendingPatientLoad.current;

        const promise = fetcher()
            .then(fetched => {
                setPatient(fetched);
                return fetched;
            })
            .finally(() => {
                pendingPatientLoad.current = null;
            });

        pendingPatientLoad.current = promise;
        return promise;
    }, [setPatient, patientRef]);

    const clear = useCallback(() => {
        setPatient(null);
        setResources({});
        setError(null);
        setIsLoading(false);
        pendingLazyLoads.current = {};
        pendingPatientLoad.current = null;
    }, [setPatient, setResources]);

    return {
        patient,
        resources,
        isLoading,
        error,
        load,
        loadFromFHIRServer,
        lazy,
        getPatient,
        clear
    };
}

export function ClinicalDataProvider({ children }: PropsWithChildren) {
    const { patient, resources, isLoading, error, load, loadFromFHIRServer, lazy, getPatient, clear } = useClinicalDataState();

    // Resolves with the loaded patient, or null if the user cancels. A failed
    // load rejects, like every loadFrom*, and also sets `error`.
    const selectFile = useCallback(() => {
        return new Promise<Patient | null>((resolve, reject) => {
            const input = getSharedInput();

            // This call takes over the picker, so an earlier call still
            // waiting on it would otherwise never settle.
            takePendingSelection()?.onCancel();

            _pendingSelection = {
                onFile: (file) => {
                    const isNdjson = file.name.endsWith('.ndjson') || file.type === 'application/x-ndjson';
                    load(isNdjson ? { type: 'ndjson-file', file } : { type: 'bundle-file', file })
                        .then(dataSet => resolve(dataSet.patient ?? null), reject);
                },
                onCancel: () => resolve(null)
            };

            input.click();
        });
    }, [load]);

    // Built once, apart from the data, so the loadFrom* wrappers keep their
    // identity when the data changes.
    const actions = useMemo(
        () => ({
            loadFromBundle    : (bundle: FhirBundle)            => load({ type: 'bundle'     , bundle }),
            loadFromBundleFile: (file: File)                    => load({ type: 'bundle-file', file }),
            loadFromResources : (nextResources: FhirResource[]) => load({ type: 'resources'  , resources: nextResources }),
            loadFromNdjson    : (ndjson: string)                => load({ type: 'ndjson'     , ndjson }),
            loadFromNdjsonFile: (file: File)                    => load({ type: 'ndjson-file', file }),
            loadFromFHIRServer,
            lazy,
            getPatient,
            selectFile,
            clear
        }),
        [load, loadFromFHIRServer, lazy, getPatient, selectFile, clear]
    );

    const value = useMemo<ClinicalDataContextValue>(
        () => ({ patient, resources, isLoading, error, ...actions }),
        [patient, resources, isLoading, error, actions]
    );

    return (
        <ClinicalDataContext.Provider value={value}>
            {children}
        </ClinicalDataContext.Provider>
    );
}

export function useClinicalData() {
    const context = useContext(ClinicalDataContext);
    if (!context) {
        throw new Error('useClinicalData must be used within a ClinicalDataProvider.');
    }
    return context;
}