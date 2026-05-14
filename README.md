# clinical-primitives

React components and SCSS-powered styles for healthcare applications. Built for FHIR R4 apps — load a patient bundle and render conditions, observations, medications, and immunizations with a single component.

> **⚠️ Work in progress — not production-ready.**
> This library is under active development. APIs, component interfaces, and visual design are unstable and will change without notice before a 1.0 release. Do not use in production.

## Install

```bash
npm install clinical-primitives
```

React 19 is required as a peer dependency.

## Setup

Import the stylesheet once at your app root:

```ts
import 'clinical-primitives/styles.css';
```

Wrap your app (or the relevant subtree) in `ClinicalDataProvider`:

```tsx
import { ClinicalDataProvider } from 'clinical-primitives';

export function App() {
  return (
    <ClinicalDataProvider>
      <YourApp />
    </ClinicalDataProvider>
  );
}
```

## Loading patient data

Use the `useClinicalData` hook to load a FHIR bundle and then read the parsed resources:

```tsx
import { useClinicalData } from 'clinical-primitives';

function PatientLoader() {
  const { loadFromBundle, isLoading, error } = useClinicalData();

  useEffect(() => {
    loadFromBundle(myFhirBundle);
  }, []);

  if (isLoading) return <span>Loading…</span>;
  if (error)     return <span>Error: {error.message}</span>;
  return <PatientView />;
}
```

`ClinicalDataProvider` supports several input formats:

| Method | Input |
|--------|-------|
| `loadFromBundle(bundle)` | FHIR Bundle object |
| `loadFromBundleFile(file)` | `File` object containing a Bundle JSON |
| `loadFromNdjson(text)` | NDJSON string (one resource per line) |
| `loadFromNdjsonFile(file)` | `File` object containing NDJSON |
| `selectFile()` | Opens a file picker; auto-detects `.json` vs `.ndjson` |
| `clear()` | Removes all loaded data |

## Clinical components

All clinical components read from the nearest `ClinicalDataProvider` automatically.

### ObservationCard

Displays a single observation with its current value, trend sparkline, delta from previous reading, and clinical status (normal / warning / abnormal).

```tsx
import { ObservationCard } from 'clinical-primitives';

<ObservationCard
  observation={obs}
  history={priorObservations}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `observation` | `Observation` | The observation to display |
| `history` | `Observation[]` | Prior readings for the sparkline and delta |

### ConditionList

Renders a list of conditions grouped by clinical status (active, remission, resolved, …).

```tsx
import { ConditionList } from 'clinical-primitives';

<ConditionList conditions={conditions} title="Problems" />
```

| Prop | Type | Description |
|------|------|-------------|
| `conditions` | `Condition[]` | Array of FHIR Condition resources |
| `title` | `string` | Optional panel heading |

### ImmunizationList

Renders a list of immunizations grouped by status (completed, not-done, entered-in-error).

```tsx
import { ImmunizationList } from 'clinical-primitives';

<ImmunizationList immunizations={immunizations} />
```

| Prop | Type | Description |
|------|------|-------------|
| `immunizations` | `Immunization[]` | Array of FHIR Immunization resources |

### MedicationList

Renders a list of medications from `MedicationRequest` or `MedicationAdministration` resources, grouped by status.

```tsx
import { MedicationList } from 'clinical-primitives';

<MedicationList medications={medications} />
```

| Prop | Type | Description |
|------|------|-------------|
| `medications` | `MedicationRequest[] \| MedicationAdministration[]` | Array of FHIR medication resources |

## Basic components

These are general-purpose UI primitives used internally and available for your own layouts.

### Badge

```tsx
<Badge variant="danger">Critical</Badge>
<Badge variant="success" radius="pill" hard>Active</Badge>
```

`variant`: `danger` | `warning` | `success` | `info` | `neutral` | `muted` | `link`  
`radius`: `none` | `sm` | `md` | `lg` | `pill` | `full`  
`hard`: solid background instead of soft tint

### Button

```tsx
<Button variant="success" onClick={save}>Save</Button>
<Button variant="neutral" virtual>Cancel</Button>
```

Same `variant` and `radius` props as Badge. `virtual`: transparent until hovered.

### Panel

Structured card with optional header, toolbar, body, and footer regions.

```tsx
<Panel>
  <PanelHeader title="Conditions" icon={<ListIcon />} />
  <PanelBody>{/* content */}</PanelBody>
</Panel>
```

### Tabs

```tsx
<Tabs>
  <TabBar>
    <Tab>Summary</Tab>
    <Tab>Details</Tab>
  </TabBar>
  <TabsBody>
    <TabContents>Summary content</TabContents>
    <TabContents>Detail content</TabContents>
  </TabsBody>
</Tabs>
```

### Sparkline

Renders a compact multi-series line chart. Typically generated from FHIR observations via `computeMultiSparklines`.

```tsx
import { Sparkline, computeMultiSparklines } from 'clinical-primitives';

const series = computeMultiSparklines(observations, { highlightObs: latest });
<Sparkline series={series} height={24} />
```

### Dialog

```tsx
<Dialog open={open} onClose={() => setOpen(false)} title="Details">
  Content here
</Dialog>
```

### Collapse

```tsx
<Collapse open={isOpen}>
  Hidden until open is true
</Collapse>
```

### Other primitives

`Dot`, `DateDisplay`, `List`, `ListItem`, `JsonViewer` — see source and the docs app for usage.

## Theming

The library uses CSS custom properties for colors, spacing, and radii. Dark mode is supported via a `data-theme` attribute:

```ts
document.documentElement.setAttribute('data-theme', 'dark');   // dark
document.documentElement.setAttribute('data-theme', 'light');  // light
// omit the attribute for system default
```

Color and spacing tokens follow the `--cp-*` prefix convention and can be overridden in your own stylesheet.

## Utilities

Domain-specific helpers are exported under the `utils` namespace:

```ts
import { utils } from 'clinical-primitives';

utils.Condition.getName(condition);
utils.Medication.normalizeMedName(rawName);
utils.Immunization.getRoute(immunization);
utils.ellipsis(text, 40);
utils.roundToPrecision(value, 2);
```

## Data parsing helpers

```ts
import {
  bundleToResources,
  resourcesToPatientDataSet,
  parseNdjson,
  resolvePatientDataSource,
} from 'clinical-primitives';
```

| Function | Description |
|----------|-------------|
| `bundleToResources(bundle)` | Extracts resources from a FHIR Bundle |
| `resourcesToPatientDataSet(resources)` | Groups resources by type; asserts exactly one Patient |
| `parseNdjson(text)` | Parses an NDJSON string into an array of resources |
| `resolvePatientDataSource(source)` | Resolves any `PatientDataSource` input to a `PatientDataSet` |

## Development

```bash
npm install
npm run dev          # start the docs preview app
npm run dev:lib      # watch-build the library (types + bundle)
npm run build        # build both library and docs app
npm run build:lib    # library only → dist/
npm run build:docs   # docs SPA only → docs-dist/
```

## License

Apache-2.0 — see [LICENSE](LICENSE).
