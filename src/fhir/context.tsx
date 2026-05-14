import { resolvePatientDataSource } from './parse';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
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

// --- Singleton file input (one per page regardless of how many providers) ---

let _sharedInput: HTMLInputElement | null = null;
let _pendingCallback: ((file: File) => void) | null = null;

function getSharedInput(): HTMLInputElement {
    if (!_sharedInput) {
        _sharedInput = document.createElement('input');
        _sharedInput.type = 'file';
        _sharedInput.accept = '.json,.ndjson';
        _sharedInput.style.display = 'none';
        _sharedInput.addEventListener('change', () => {
            const file = _sharedInput?.files?.[0];
            if (file) _pendingCallback?.(file);
            if (_sharedInput) _sharedInput.value = '';
            _pendingCallback = null;
        });
        document.body.appendChild(_sharedInput);
    }
    return _sharedInput;
}

// ---------------------------------------------------------------------------

export type ClinicalDataContextValue = {
    patient: PatientResource | null;
    resources: ResourcesByType;
    isLoading: boolean;
    error: Error | null;
    loadFromBundle: (bundle: FhirBundle) => Promise<PatientDataSet>;
    loadFromBundleFile: (file: File) => Promise<PatientDataSet>;
    loadFromResources: (resources: FhirResource[]) => Promise<PatientDataSet>;
    loadFromNdjson: (ndjson: string) => Promise<PatientDataSet>;
    loadFromNdjsonFile: (file: File) => Promise<PatientDataSet>;
    selectFile: () => void;
    clear: () => void;
};

const ClinicalDataContext = createContext<ClinicalDataContextValue | null>(null);

function useClinicalDataState() {
    const [patient  , setPatient  ] = useState<PatientResource | null>(null);
    const [resources, setResources] = useState<ResourcesByType>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error    , setError    ] = useState<Error | null>(null);

    async function load(source: PatientDataSource) {
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
    }

    function clear() {
        setPatient(null);
        setResources({});
        setError(null);
        setIsLoading(false);
    }

    return {
        patient,
        resources,
        isLoading,
        error,
        load,
        clear
    };
}

export function ClinicalDataProvider({ children }: PropsWithChildren) {
    const { patient, resources, isLoading, error, load, clear } = useClinicalDataState();

    const selectFile = useCallback(() => {
        const input = getSharedInput();
        _pendingCallback = async (file) => {
            const isNdjson = file.name.endsWith('.ndjson') || file.type === 'application/x-ndjson';
            await load(isNdjson ? { type: 'ndjson-file', file } : { type: 'bundle-file', file });
        };
        input.click();
    }, [load]);

    const value = useMemo<ClinicalDataContextValue>(
        () => ({
            patient,
            resources,
            isLoading,
            error,
            loadFromBundle: (bundle) => load({ type: 'bundle', bundle }),
            loadFromBundleFile: (file) => load({ type: 'bundle-file', file }),
            loadFromResources: (nextResources) => load({ type: 'resources', resources: nextResources }),
            loadFromNdjson: (ndjson) => load({ type: 'ndjson', ndjson }),
            loadFromNdjsonFile: (file) => load({ type: 'ndjson-file', file }),
            selectFile,
            clear
        }),
        [patient, resources, isLoading, error, selectFile]
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