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

React 19 is required as a peer dependency. The install clones the repo and builds `dist/` in its
`prepare` script, which needs Node 20.19+ or 22.12+ (Vite 7's requirement). Add `@types/fhir` as a
dev dependency if your app imports `fhir/r4` types.

## Setup

Import the stylesheet once at your app root, **before your own CSS**:

```ts
import 'clinical-primitives/styles.css';
import './app.css';
```

The library's scoped reset (it zeroes margin, padding and border on `cp-*` elements and their
contents) lives in a cascade layer named `cp-reset`, so any unlayered app CSS beats it. Among
layers, the one declared first ranks lowest, so load order matters if your own CSS is layered —
Tailwind v4 is. Loaded first, `cp-reset` ranks under all of your layers, and utilities like `p-4`
or `mt-2` on content you pass into `Panel`, `Dialog` or `Column` work as written. If your
stylesheet has to load first, name the layer ahead of your own:

```css
/* app.css, Tailwind v4 */
@layer cp-reset;
@import "tailwindcss";
```

The stylesheet also gives `html` a system sans-serif font, so components don't fall back to the
browser's serif. It is a default only: any `font-family` you set on `html`, `body` or a wrapper
wins, and the components inherit it.

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
import { useEffect } from 'react';
import { useClinicalData } from 'clinical-primitives';

function PatientLoader() {
  const { loadFromBundle, isLoading, error } = useClinicalData();

  useEffect(() => {
    // Failures also land in `error`; catching keeps them out of the console.
    loadFromBundle(myFhirBundle).catch(() => {});
  }, [loadFromBundle]);

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
| `loadFromResources(resources)` | Array of FHIR resources |
| `loadFromNdjson(text)` | NDJSON string (one resource per line) |
| `loadFromNdjsonFile(file)` | `File` object containing NDJSON |
| `loadFromFHIRServer(baseUrl, patientId, options?)` | Pages through `Patient/{id}/$everything` on a FHIR server |
| `selectFile()` | Opens a file picker; auto-detects `.json` vs `.ndjson` |
| `clear()` | Removes all loaded data |

How they behave:

- **Every function from `useClinicalData()` is stable** for the life of the provider, so it's safe
  to list in an effect's dependency array.
- Every input must contain **exactly one** `Patient`. Each `loadFrom*` sets `patient`, `resources`,
  `isLoading` and `error`, and also returns a promise that resolves to the loaded data set or
  rejects with the error.
- **The latest load wins.** If a slow load finishes after a newer one (or after `clear()`), it
  still settles for its own caller but doesn't touch the context.
- `selectFile()` resolves with the loaded `Patient`, or with `null` if the user cancels the picker.
  A file that fails to load rejects the promise (and sets `error`).
- `loadFromFHIRServer` streams: `patient` and `resources` update as each page arrives. Options are
  `{ signal, count = 200, throttleMs = 500, retries = 3, retryDelayMs = 1000 }`. Network errors,
  5xx, 408 and 429 responses are retried with exponential backoff; other 4xx responses fail at
  once. Aborting through `signal` rejects the call but **doesn't** set `error`, so cancelling in an
  effect cleanup (as React StrictMode does in development) leaves the context clean:

```tsx
useEffect(() => {
  const controller = new AbortController();
  loadFromFHIRServer(baseUrl, patientId, { signal: controller.signal }).catch(() => {});
  return () => controller.abort();
}, [loadFromFHIRServer, baseUrl, patientId]);
```

- `lazy(resourceType, fetcher)` and `getPatient(id, fetcher)` load one resource type, or one
  patient, on demand and cache it; see [AGENTS.md](AGENTS.md#data-layer).

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

History readings in another unit of the same kind (mg/dL against mg/L, lb against kg) are converted
to the card's unit before they're plotted or compared; ones that can't be converted (mmol/L against
mg/dL) are left out.

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

The Date/Status order toggle appears only when ordering by status would change something — when the
cards carry different statuses (from `interpretation` codes or reference ranges). Data without them,
such as Synthea output, shows no toggle. On a tab where every card has the same status, the Status
button is disabled.

### LabTrendPanel

Compact table — one row per tracked lab, each with a sparkline, latest value, reference range, and a flag. **Connected** — reads observations from context, no data prop.

```tsx
import { LabTrendPanel } from 'clinical-primitives';

<LabTrendPanel labs={['CRP', 'Hemoglobin', 'Albumin']} />

// Presets and custom rows mix freely
<LabTrendPanel labs={['CRP', { label: 'Lactoferrin', keywords: ['lactoferrin'] }]} />
```

`labs` entries are either a preset key (`LABS` in `src/components/Observation/ObservationFilters.ts`
has the full list — CRP, ESR, Albumin, Calprotectin, Hemoglobin, Platelets, VitaminD, WBC, ALT,
BloodPressure, and more) or a custom `{ label, loincs?, keywords? }` object.

How readings are sorted into rows:

- Each reading goes to **at most one row**. A code match beats a keyword match; when two rows list
  the same code, the earlier row wins.
- A reading coded in LOINC under a code no row lists goes to **no row**, whatever its name says —
  Hemoglobin A1c (`4548-4`) stays out of the Hemoglobin row.
- Otherwise, keywords are matched as whole words against the reading's `code.text` and coding
  displays, and the longest matching keyword wins ("prealbumin" beats "albumin"). Keywords are for
  data with local codes or no codes at all.

Within a row, readings are converted to the latest reading's unit (mg/dL to mg/L, lb to kg, and so
on). Readings in a unit that can't be converted (mmol/L in a mass-unit row) are left off the
sparkline, and the row says so ("2 in mmol/L not plotted").

The flag comes from the latest reading's `interpretation` code when the lab sent one, otherwise
from comparing its value with the reference range. Every part of a row — name, range, sparkline,
value, flag — has a tooltip explaining what it shows: which tests the row gathered, where the range
came from, why a flag was raised. Mount [`<Tooltip />`](#tooltip) to see them.

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

Malformed JSON, or an instruction that fails to render, shows as a danger `Alert` in its place
rather than crashing the tree; an unknown `type` renders an "Unhandled type" message.

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

Both have `min-height: 0`, so inside a container of definite height (an app shell, a parent
`Column`) they shrink to their share of it and the lists inside them scroll. Neither imposes a
height of its own; give a row a `minHeight` style where it needs a floor.

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

Uncontrolled by default, starting on `defaultIndex`. Pass `activeIndex` to control it, and
`onActiveIndexChange` to hear about tab clicks either way:

```tsx
const [tab, setTab] = useState(0);

<Tabs activeIndex={tab} onActiveIndexChange={setTab}>…</Tabs>
```

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

Several components (`TimelineChart` bars, `ObservationChart` markers, `LabTrendPanel` cells) already emit `data-tooltip` attributes and need a mounted `<Tooltip/>` to show anything.

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

### Dates

`DateDisplay`, `lib.formatDate` and every component that shows a date treat FHIR `date` values as
calendar days, not instants: `"2024-01-01"` reads as Jan 1, 2024 in every time zone (not Dec 31
west of UTC), and partial dates keep their precision — `"2024-03"` is "Mar 2024", `"2019"` is
"2019". `dateTime` values with a time are shown in local time.

```tsx
<DateDisplay date="2024-03" />          {/* Mar 2024 */}
lib.formatDate('2024-01-01');           // "Jan 1, 2024", in any time zone
```

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
| `parseNdjson(text)` | Parses an NDJSON string into an array of resources. Every line needs a `resourceType` and an `id`; a line without an `id` throws, naming the line, since it usually means a non-FHIR file was concatenated in |
| `resolvePatientDataSource(source)` | Resolves any `PatientDataSource` input to a `PatientDataSet` |

## Development

Use Node 22.13+ (or 24+); CI runs Node 22. Building alone works on Node 20.19+, but the test
runner (Vitest 5 with jsdom) needs 22.13+.

```bash
npm ci                              # install; `prepare` also builds dist/
npm run dev                         # start the docs preview app
npm run dev:lib                     # watch-build the library (types + bundle)
npm run build                       # build both library and docs app
npm run build:lib                   # library only → dist/
npm run build:docs                  # docs SPA only → docs-dist/
npm test                            # run the test suite once
npm run test:watch                  # re-run tests on change
npx tsc -p tsconfig.json --noEmit   # typecheck everything, docs included
```

The docs build prints Vite's "chunks larger than 500 kB" warning; that's expected.

### Contributing

- Tests use [Vitest](https://vitest.dev), in Node by default; component tests opt into jsdom with
  `// @vitest-environment jsdom` and use React Testing Library. They sit next to
  the code they cover, as `<name>.test.ts` or `<name>.test.tsx` (e.g.
  `src/fhir/context.test.tsx`), and are excluded from the library build.
- The suite runs with `TZ=America/New_York` (set in `vitest.config.ts`), west of UTC, so date
  bugs that only show outside UTC fail locally and in CI alike.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, which also builds the library, then the
  typecheck and `npm test`, on every push to `main` and every pull request. Run the same three
  before opening a PR.
- A new component gets a docs page in `src/docs/pages/`, registered in `src/docs/routes.ts` and
  `src/docs/DocsApp.tsx`, and is public only once exported from `src/index.ts`.
- Every CSS class the library emits starts with `cp-`.

## License

Apache-2.0 — see [LICENSE](LICENSE).
