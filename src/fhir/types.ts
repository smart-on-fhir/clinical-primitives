export type FhirPrimitive = string | number | boolean | null;

export type FhirValue =
  | FhirPrimitive
  | FhirObject
  | FhirValue[];

export type FhirObject = {
  [key: string]: FhirValue;
};

export type FhirResource = FhirObject & {
  resourceType: string;
  id?: string;
};

export type FhirBundleEntry = {
  resource?: FhirResource;
};

export type FhirBundle = FhirResource & {
  resourceType: 'Bundle';
  entry?: FhirBundleEntry[];
};

export type PatientResource = FhirResource & {
  resourceType: 'Patient';
};

export type ResourcesByType = Record<string, FhirResource[]>;

export type PatientDataSet = {
  patient: PatientResource;
  resources: ResourcesByType;
};

export type PatientDataSource =
  | { type: 'bundle'; bundle: FhirBundle }
  | { type: 'bundle-file'; file: File }
  | { type: 'resources'; resources: FhirResource[] }
  | { type: 'ndjson'; ndjson: string }
  | { type: 'ndjson-file'; file: File };