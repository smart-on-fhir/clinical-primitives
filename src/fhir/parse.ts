import type {
  FhirBundle,
  FhirResource,
  PatientDataSet,
  PatientDataSource,
  PatientResource
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

  if (patients.length > 1) {
    throw new Error('Expected one Patient resource, but multiple were found.');
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

export function resourcesToPatientDataSet(resources: FhirResource[]): PatientDataSet {
  const patient = assertSinglePatient(resources);

  return {
    patient,
    resources: groupResourcesByType(resources/*.filter((resource) => resource !== patient)*/)
  };
}

export function parseNdjson(ndjson: string): FhirResource[] {
  return ndjson
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parsed = JSON.parse(line) as unknown;

      if (!isFhirResource(parsed)) {
        throw new Error('Encountered an NDJSON line that is not a FHIR resource object.');
      }

      return parsed;
    });
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