import type {
  FhirBundle,
  FhirResource,
  PatientDataSet,
  PatientDataSource,
  PatientResource,
  ResourcesByType
} from './types';

function isFhirResource(value: unknown): value is FhirResource {
  return typeof value === 'object' && value !== null && 'resourceType' in value && typeof (value as FhirResource).resourceType === 'string';
}

function isBundle(resource: FhirResource): resource is FhirBundle {
  return resource.resourceType === 'Bundle';
}

function isPatient(resource: FhirResource): resource is PatientResource {
  return resource.resourceType === 'Patient';
}

function assertSinglePatient(resources: FhirResource[]): PatientResource {
  const patients = resources.filter(isPatient);

  if (patients.length === 0) {
    throw new Error('Expected one Patient resource, but none were found.');
  }

  const uniqueIds = new Set(patients.map(p => p.id));
  if (uniqueIds.size > 1) {
    throw new Error('Expected one Patient resource, but multiple distinct patients were found.');
  }

  return patients[0];
}

export function bundleToResources(bundle: FhirBundle): FhirResource[] {
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is FhirResource => isFhirResource(resource));
}

export function groupResourcesByType(resources: FhirResource[]) {
  return resources.reduce<Record<string, FhirResource[]>>((accumulator, resource) => {
    const resourceList = accumulator[resource.resourceType] ?? [];
    resourceList.push(resource);
    accumulator[resource.resourceType] = resourceList;
    return accumulator;
  }, {});
}

export function mergeResourcesByType(existing: ResourcesByType, incoming: FhirResource[]): ResourcesByType {
  const result = { ...existing };
  for (const resource of incoming) {
    const list = result[resource.resourceType] ?? [];
    // Skip duplicates (some servers repeat resources across pages)
    if (resource.id && list.some(r => r.id === resource.id)) continue;
    result[resource.resourceType] = [...list, resource];
  }
  return result;
}

export function resourcesToPatientDataSet(resources: FhirResource[]): PatientDataSet {
  const patient = assertSinglePatient(resources);

  return {
    patient,
    resources: groupResourcesByType(resources/*.filter((resource) => resource !== patient)*/)
  };
}

// Unlike bundles, NDJSON (bulk export) always carries resource ids, so a row
// without one is treated as a non-FHIR file mixed into the input. Without this
// check such rows reach assertSinglePatient, where an id-less "Patient" row
// counts as a second distinct patient.
export function parseNdjson(ndjson: string): FhirResource[] {
  const resources: FhirResource[] = [];

  ndjson.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const lineNumber = index + 1;
    const parsed = JSON.parse(line) as unknown;

    if (!isFhirResource(parsed)) {
      throw new Error(`NDJSON line ${lineNumber} is not a FHIR resource object.`);
    }

    if (typeof parsed.id !== 'string' || !parsed.id) {
      throw new Error(
        `NDJSON line ${lineNumber} has resourceType "${parsed.resourceType}" but no id. Is a non-FHIR file mixed in?`
      );
    }

    resources.push(parsed);
  });

  return resources;
}

export async function readTextFile(file: File): Promise<string> {
  return await file.text();
}

export async function resolvePatientDataSource(source: PatientDataSource): Promise<PatientDataSet> {
  switch (source.type) {
    case 'bundle':
      return resourcesToPatientDataSet(bundleToResources(source.bundle));
    case 'bundle-file': {
      const text = await readTextFile(source.file);
      const parsed = JSON.parse(text) as unknown;

      if (!isFhirResource(parsed) || !isBundle(parsed)) {
        throw new Error('Bundle file did not contain a FHIR Bundle resource.');
      }

      return resourcesToPatientDataSet(bundleToResources(parsed));
    }
    case 'resources':
      return resourcesToPatientDataSet(source.resources);
    case 'ndjson':
      return resourcesToPatientDataSet(parseNdjson(source.ndjson));
    case 'ndjson-file': {
      const text = await readTextFile(source.file);
      return resourcesToPatientDataSet(parseNdjson(text));
    }
    default:
      throw new Error('Unsupported patient data source.');
  }
}