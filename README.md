# clinical-primitives

React components and SCSS-powered styles for healthcare applications. Built for FHIR R4 apps — load a patient bundle and render conditions, observations, medications, and immunizations with a single component.

> **⚠️ Work in progress — not production-ready.**
> This library is under active development. APIs, component interfaces, and visual design are unstable and will change without notice before a 1.0 release. Do not use in production.

Building an app with this library using an AI coding agent? Point it at
[AGENTS.md](AGENTS.md) — a full component reference and decision guide
written for that purpose (this README only covers a subset of exports).

## Install

```bash
npm install github:smart-on-fhir/clinical-primitives
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

Some clinical components take FHIR resources as explicit props (fully controlled, no context needed);
others are "connected" and read straight from the nearest `ClinicalDataProvider` when you don't pass
the data yourself. Each entry below says which. See [AGENTS.md](AGENTS.md) for full prop tables and
constraints.

### ObservationCard

Displays a single observation with its current value, trend sparkline, delta from previous reading, and clinical status (normal / warning / abnormal). Needs a `ClinicalDataProvider` ancestor (its "view source" dialog resolves references from context).

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
| `history` | `Observation[]` | Prior readings of the same analyte, for the sparkline and delta |

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

### ObservationsPanel

Grid of `ObservationCard`s with filter tabs and a date/status sort toggle. **Connected** — reads observations from context, no data prop.

```tsx
import { ObservationsPanel } from 'clinical-primitives';

<ObservationsPanel filters={['Vitals', 'Labs']} />
```

`filters`: any of `'All' | 'Vitals' | 'Labs' | 'Social' | 'Activity' | 'IBD'`.

### LabTrendPanel

Compact table — one row per tracked lab, each with a sparkline, latest value, reference range, and a flag. **Connected** — reads observations from context, no data prop.

```tsx
import { LabTrendPanel } from 'clinical-primitives';

<LabTrendPanel labs={['CRP', 'Hemoglobin', 'Albumin']} />
```

`labs` entries are either a preset key (see `LabTrendPanel`'s source for the full list — CRP, Hemoglobin, Platelets, VitaminD, WBC, ALT, BloodPressure, and more) or a custom `{ label, loincs?, keywords? }` object.

### ObservationChart

Standalone line chart for one analyte, with reference-range shading, hover tooltip, and click-to-select. No context needed — pure props in, SVG out.

```tsx
import { ObservationChart } from 'clinical-primitives';

<ObservationChart observations={observations} code="2160-0" onSelectPoint={obs => ...} />
```

`code` can be a single LOINC code, an array of codes, or a `(obs) => boolean` predicate.

### ObservationHistoryTable

Sortable date/value table of an analyte's readings.

```tsx
import { ObservationHistoryTable } from 'clinical-primitives';

<ObservationHistoryTable history={observations} />
```

### EventFeed

Chronological feed of clinical events (labs, vitals, meds, notes, procedures, immunizations, abnormal-result alerts) with a time-range filter.

```tsx
import { EventFeed } from 'clinical-primitives';

<EventFeed resources={{ Observation: observations, MedicationRequest: medications }} />
```

`resources` is required and explicit — pass whichever `resources.X` arrays from `useClinicalData()` you want included.

### TimelineChart

A shared, pannable/zoomable time axis with stackable sections — medication courses, lab trends, and generic intervals, all aligned on one x-axis.

```tsx
import { TimelineChart } from 'clinical-primitives';

<TimelineChart title="Patient History">
  <TimelineChart.MedicationsTimeline />
  <TimelineChart.ObservationsTimeline />
</TimelineChart>
```

`MedicationsTimeline`/`ObservationsTimeline` read from context when their data props are omitted (needs `ClinicalDataProvider`); `TimelineChart.BarChartTimeline` is domain-agnostic and takes plain `rows` — no FHIR or context involved.

### FindingCard

Card for an AI-generated finding/insight: concern badge, confidence bar, and tabbed supporting evidence (labs, meds, conditions, imaging, narrative text, cohort stats). No context needed.

```tsx
import { FindingCard } from 'clinical-primitives';

<FindingCard title="Possible medication interaction" concernLevel="high" confidenceLevel={0.82} />
```

### StaticComponent

Renders a JSON instruction tree as UI — built so an LLM can describe a screen without writing JSX. See [AGENTS.md](AGENTS.md#staticcomponent--llm-driven-rendering) for the full instruction schema.

```tsx
import { StaticComponent } from 'clinical-primitives';

<StaticComponent instruction={{ type: 'lab_trend_panel', labs: ['CRP', 'Hemoglobin'] }} />
```

### SourceDialog / FhirResourceJsonViewer / AttachmentPreview

The "view raw FHIR" stack used internally by `ObservationCard` and `EventFeed`. `SourceDialog` needs `ClinicalDataProvider`; `FhirResourceJsonViewer` takes `allResources` explicitly.

```tsx
import { SourceDialog } from 'clinical-primitives';

<SourceDialog open={open} onClose={close} resource={observation} />
```

## Basic components

General-purpose UI primitives, no FHIR knowledge — used internally and available for your own layouts.

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

### Alert

Block-level message/banner, same prop surface as `Badge`/`Button` (`variant`, `radius`, `hard`).

```tsx
<Alert variant="warning">Some readings are more than a year old.</Alert>
```

### Panel

Structured card with optional header, toolbar, body, and footer regions.

```tsx
<Panel>
  <PanelHeader title="Conditions" icon={<ListIcon />} />
  <PanelBody>{/* content */}</PanelBody>
</Panel>
```

> Only `Panel` itself is exported from the package root today — `PanelHeader`/`PanelBody`/`PanelToolbar`/`PanelFooter` aren't re-exported yet.

### Row / Column

Flex layout wrappers. `Row` also accepts `cols` to switch to a CSS grid.

```tsx
<Row cols="1fr 1fr">
  <Column>Left</Column>
  <Column>Right</Column>
</Row>
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

`Tab`/`TabContents` pairs are matched by position, not id — the Nth `Tab` activates the Nth `TabContents`.

### Sparkline

Renders a compact multi-series line chart. Typically generated from FHIR observations via `computeMultiSparklines`.

```tsx
import { Sparkline, computeMultiSparklines } from 'clinical-primitives';

const series = computeMultiSparklines(observations, { highlightObs: latest });
<Sparkline series={series} height={24} />
```

### Chart

General-purpose Recharts wrapper for any non-FHIR visualization: line, area, bar/column, scatter, pie, radar, radialBar, funnel, treemap, composed.

```tsx
import { Chart } from 'clinical-primitives';

<Chart type="line" data={rows} xKey="date" yKey="value" />
<Chart type="pie" slices={[{ name: 'A', value: 10 }, { name: 'B', value: 20 }]} />
```

### DataGrid

Sortable, resizable, searchable, paginated, selectable data table. A controlled component, like `Pagination` below — you supply the current page of `rows` plus `count`/`offset`/`limit`, and respond to `onSortChange`/`onPaginationChange`/`onSearchChange`. It needs no backend — it's pure presentation, nothing is fetched for you; if you want one that fetches from a backend, build that fetching logic yourself and feed the result in.

```tsx
import { DataGrid } from 'clinical-primitives';

<DataGrid
  columns={[{ propName: 'name', label: 'Name', sortProp: 'name' }]}
  rows={currentPageRows}
  count={total}
  offset={offset}
  limit={limit}
  onPaginationChange={setOffset}
/>
```

### Pagination

Numbered pager. Fully controlled: `offset`, `limit`, `total`, `onChange`. Renders nothing for fewer than two pages.

```tsx
<Pagination offset={offset} limit={20} total={total} onChange={setOffset} />
```

### Menu / MenuButton

Dropdown menu building blocks (`Menu`, `MenuItem`, `MenuItemGroupHeader`, `MenuSeparator`) paired with `MenuButton`, which owns the open/close behavior via CSS focus (no JS open state).

```tsx
<MenuButton tabIndex={0} menu={
  <Menu>
    <MenuItem icon={<Pencil />}>Edit</MenuItem>
    <MenuItem icon={<Trash2 />}>Delete</MenuItem>
  </Menu>
}>
  Actions
</MenuButton>
```

### RadioButton

Segmented single-select control, fully controlled.

```tsx
<RadioButton
  value={status}
  onChange={setStatus}
  options={[{ value: 'active', label: 'Active' }, { value: 'resolved', label: 'Resolved' }]}
/>
```

### ItemList

Editable list of strings or key/value pairs.

```tsx
<ItemList params={queryParams} onChange={setQueryParams} getNewItem={() => ['', '']} />
```

### CheckBox / Loader

```tsx
<CheckBox indeterminate={someButNotAllChecked} checked={allChecked} onChange={toggle} />
<Loader msg="Loading patient data…" centered />
```

### Tooltip

A **global singleton** — mount `<Tooltip />` once near your app root, then trigger it from any element (React or not) with `data-tooltip-*` attributes:

```tsx
<Tooltip />
{/* elsewhere in the tree */}
<span data-tooltip="Extra detail" data-tooltip-trigger="click">ⓘ</span>
```

Several components (`TimelineChart` bars, `ObservationChart` markers) already emit `data-tooltip` attributes and need a mounted `<Tooltip/>` to show anything.

### Dialog

```tsx
<Dialog open={open} onClose={() => setOpen(false)} title="Details">
  Content here
</Dialog>
```

### Collapse

```tsx
<Collapse label="Details" open={isOpen} onToggle={setIsOpen}>
  Hidden until open is true
</Collapse>
```

### JsonViewer

Recursive collapsible tree viewer for arbitrary JSON. `FhirResourceJsonViewer` (above) is a FHIR-aware preset built on this.

```tsx
<JsonViewer data={someObject} />
```

### Other primitives

`Dot` (small color indicator), `DateDisplay` (formatted date + native tooltip), `List`/`ListItem` (plain scrollable list) — see source and the docs app for usage.

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
utils.Immunization.getRoute(immunization);
utils.ellipsis(text, 40);
utils.roundToPrecision(value, 2);
utils.highlightText(text, search); // wraps matches in <mark> — what DataGrid's search uses
```

A separate `lib` namespace has broader FHIR helpers not scoped to one component — person/patient display formatting, identifier matching, and medication name/dose parsing:

```ts
import { lib } from 'clinical-primitives';

lib.formatDate(patient.birthDate);
lib.Patient.displayPatientAge(patient);
lib.Medication.getShortMedicationName(medicationRequest);
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
