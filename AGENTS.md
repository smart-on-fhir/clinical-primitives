# clinical-primitives — Agent Guide

This file is written for an AI coding agent building an app with this
library, not for a human skimming a README. It tells you **which
component to reach for, when, and how** — with the constraints that
aren't obvious from types alone (context requirements, controlled vs.
uncontrolled state, dead/reserved props, provisional logic).

If something here conflicts with the code, the code wins — this library
is pre-1.0 and APIs move. Grep the referenced file before depending on
fine detail (exact defaults, literal unions).

> ⚠️ Pre-1.0. APIs are not stable. Don't build anything that assumes
> long-term prop compatibility.

## What this is

A React 19 component library with two halves:

1. **Generic UI primitives** — Badge, Button, Panel, Tabs, Dialog, a
   data grid, charts, menus, etc. No FHIR knowledge. Use these for any
   layout/interaction need, clinical or not.
2. **FHIR-aware clinical components** — cards, lists, panels, and a
   timeline that render `fhir/r4` resources (`Condition`, `Observation`,
   `MedicationRequest`, `Immunization`, …) into clinical UI. Most of
   these either take resources as props directly, or read them from a
   shared `ClinicalDataProvider` context if you omit the prop.

There's also `StaticComponent` — a JSON→React renderer built specifically
so an LLM can describe a UI as a JSON instruction tree instead of writing
JSX. If you're generating UI dynamically at runtime (not just using this
library to hand-write an app), read that section first.

## Install & setup

Not published to npm yet — install straight from GitHub:

```bash
npm install github:smart-on-fhir/clinical-primitives
```

Peer dependency: React 19 (`react`, `react-dom` ^19.0.0).

```tsx
import 'clinical-primitives/styles.css';   // once, at app root
import { ClinicalDataProvider } from 'clinical-primitives';

export function App() {
  return (
    <ClinicalDataProvider>
      <YourApp />
    </ClinicalDataProvider>
  );
}
```

Wrap with `ClinicalDataProvider` even if you plan to pass all data as
explicit props everywhere — many components fall back to context only
when a data prop is *omitted*, and some (`ObservationsPanel`,
`LabTrendPanel`, `SourceDialog`, `StaticComponent`, `ObservationCard`)
require the provider unconditionally. See each component's "context"
note below.

If your UI shows tooltips anywhere (`data-tooltip-*` attributes, used by
several components internally), mount `<Tooltip />` once near the app
root too — see [Tooltip](#tooltip).

## Decision guide — "I need to…"

| Need | Use |
|---|---|
| Show a patient's active/past conditions | `ConditionList` |
| Show immunization history | `ImmunizationList` |
| Show current/past medications | `MedicationList` |
| Show one lab/vital's current value + trend | `ObservationCard` |
| Show a scannable table of many labs with sparklines | `LabTrendPanel` |
| Show a browsable grid of all observations with filters | `ObservationsPanel` |
| Plot one analyte over time (standalone chart) | `ObservationChart` |
| Show a chronological feed of clinical events (labs, meds, notes, procedures, alerts) | `EventFeed` |
| Show medication courses / lab trends / arbitrary intervals on a shared, pannable/zoomable time axis | `TimelineChart` (+ its section components) |
| Render a "view source" / raw-JSON affordance for a FHIR resource | `SourceDialog` |
| Render arbitrary FHIR JSON with reference resolution | `FhirResourceJsonViewer` |
| Render an AI-generated finding/insight with evidence tabs | `FindingCard` |
| Let an LLM emit UI as JSON at runtime | `StaticComponent` |
| Tabular data — sortable, resizable, searchable, paginated, selectable | `DataGrid` |
| Tabular data from FHIR resources whose shape you don't know ahead of time | `FhirDataGrid` pattern (not exported — copy `src/components/DataGrid/FhirDataGrid.tsx`, see note below) |
| Generic (non-FHIR) chart — line/bar/pie/scatter/etc. | `Chart` |
| Numbered pager | `Pagination` |
| Dropdown menu / action menu | `Menu` + `MenuButton` |
| Segmented single-select control | `RadioButton` |
| Editable list of strings or key/value pairs | `ItemList` |
| Status pill / tag | `Badge` |
| Inline banner/message | `Alert` |
| Card/section container | `Panel` |
| Flex/grid layout wrapper | `Row`, `Column` |
| Modal dialog | `Dialog` |
| Expand/collapse disclosure | `Collapse` |
| Hover/click tooltip on anything, including non-React DOM | `Tooltip` (singleton, `data-tooltip-*` driven) |
| Loading spinner | `Loader` |
| File/bundle upload UI for FHIR data | `useClinicalData().selectFile()` |

## Data layer

### `ClinicalDataProvider` / `useClinicalData()`

`src/fhir/context.tsx`. `ClinicalDataProvider` takes only `children`.

```ts
const {
  patient,             // Patient | null
  resources,           // Record<string, FhirResource[]>, keyed by resourceType
  isLoading,           // boolean
  error,               // Error | null

  loadFromBundle,       // (bundle: FhirBundle) => Promise<PatientDataSet>
  loadFromBundleFile,   // (file: File) => Promise<PatientDataSet>
  loadFromResources,    // (resources: FhirResource[]) => Promise<PatientDataSet>
  loadFromNdjson,       // (ndjson: string) => Promise<PatientDataSet>
  loadFromNdjsonFile,   // (file: File) => Promise<PatientDataSet>
  loadFromFHIRServer,   // (baseUrl, patientId, options?) => Promise<PatientDataSet>

  selectFile,           // () => Promise<Patient | null> — opens a native file picker
  clear,                // () => void
} = useClinicalData();
```

- Throws if called outside a `ClinicalDataProvider`.
- Every `load*` method sets `isLoading`/`error`/`patient`/`resources`
  **and** throws the failure — `try/catch` even though state also
  updates, if you need to react to the specific call.
- `resourcesToPatientDataSet` (used internally by every loader) requires
  **exactly one** `Patient` resource in the input — zero or multiple
  distinct patient ids throws. Don't feed it a multi-patient bundle.
- `loadFromFHIRServer` streams pages incrementally: `resources` and
  `patient` update as pages arrive, before the returned promise resolves.
- `resources.X` is typed as loose `FhirResource[]`, not the real
  `fhir/r4` type. Passing it into a strongly-typed prop (e.g.
  `ConditionList`'s `conditions: Condition[]`) needs a cast:
  `resources.Condition as unknown as Condition[]`. This is the standard
  pattern throughout the library itself — don't fight it, just cast.

### Parse helpers (`src/fhir/parse.ts`)

| Function | Signature | Notes |
|---|---|---|
| `bundleToResources` | `(bundle: FhirBundle) => FhirResource[]` | Extracts `entry[].resource` |
| `parseNdjson` | `(ndjson: string) => FhirResource[]` | Throws on a line without a valid `resourceType` |
| `resolvePatientDataSource` | `(source: PatientDataSource) => Promise<PatientDataSet>` | Dispatches on `source.type` |
| `resourcesToPatientDataSet` | `(resources: FhirResource[]) => PatientDataSet` | Throws unless exactly one `Patient` is present |

`PatientDataSource` union: `{type:'bundle',bundle}` \|
`{type:'bundle-file',file}` \| `{type:'resources',resources}` \|
`{type:'ndjson',ndjson}` \| `{type:'ndjson-file',file}`.

## Components

Each entry: what it's for, required/important props, and constraints.
Props not mentioned are optional and rarely needed — read the source
file listed if you need the full surface.

### Clinical / FHIR components

#### ConditionList / ImmunizationList / MedicationList
`src/components/{Condition,Immunization,Medication}/*List.tsx`

Panel listing resources grouped into clickable status tabs, newest
first within a tab. All three follow the identical pattern:

```tsx
<ConditionList conditions={conditions} title="Problems" />
<ImmunizationList immunizations={immunizations} />
<MedicationList medications={medications} />  {/* MedicationRequest[] | MedicationAdministration[] */}
```

Fully controlled by the array you pass — **not** context-connected
themselves (there are internal `*ListWrapper` versions that read
context, but those aren't exported). Get the array from
`useClinicalData().resources.Condition` (etc.), cast as needed.

#### ObservationCard
`src/components/Observation/index.tsx`

One observation, headline value + sparkline + delta vs. previous +
click-through to history/explanation.

```tsx
<ObservationCard observation={obs} history={priorObservationsOfSameAnalyte} />
```

**Requires `ClinicalDataProvider`** (its info-icon dialog resolves
references from context). `history` should already be filtered to the
same clinical concept — the component dedups by display name but
doesn't group/select analytes for you. Handles multi-component
observations (e.g. blood pressure) up to 2 components; more than that
shows a placeholder instead of a chart.

#### LabTrendPanel
`src/components/Observation/LabTrendPanel.tsx`

Compact table, one row per tracked lab: sparkline + latest value + ref
range + flag (↑↑/↑H/↓↓/↓L/!/↑).

```tsx
<LabTrendPanel labs={['CRP', 'Hemoglobin', 'Albumin']} />
```

`labs` items can be a preset key string (see `LABS` dictionary in
`ObservationFilters.ts` — CRP, ESR, Albumin, Calprotectin, Hemoglobin,
Platelets, Weight, Height, BMI, Ferritin, VitaminD, VitaminB12, WBC,
RBC, ALT, AST, HeartRate, OxygenSat, Temperature, BloodPressure, and
more) or a custom `{ label, loincs?, keywords? }` object. **Requires
`ClinicalDataProvider`** — reads `resources.Observation` directly, no
prop to pass observations explicitly. Unknown preset keys are skipped
with a `console.warn`. Renders `null` if no row has data.

#### ObservationsPanel
`src/components/Observation/ObservationsPanel.tsx`

Grid of `ObservationCard`s with filter tabs and a date/status sort
toggle.

```tsx
<ObservationsPanel filters={['Vitals', 'Labs']} />
```

`filters` values: `'All' | 'Vitals' | 'Labs' | 'Social' | 'Activity' |
'IBD'`; empty/omitted falls back to an "All"/"Latest" pair. **Requires
`ClinicalDataProvider`** — no prop for passing observations in, it's a
connected component.

#### ObservationChart
`src/components/Observation/ObservationChart.tsx`

Standalone line chart for one analyte, with reference-range shading,
hover tooltip, click-to-select, monotone-cubic smoothing. No context
requirement — pure props in, SVG out.

```tsx
<ObservationChart
  observations={allObservations}
  code={['2160-0', '38483-4']}        // string | string[] | (obs) => boolean
  onSelectPoint={obs => ...}
/>
```

Set `mapX` only when embedding inside `TimelineChart` (shares an
external time scale). Memoize `code` if it's a function/array — it's a
`useMemo` dependency.

#### EventFeed
`src/components/EventFeed/index.tsx`

Chronological feed (labs, vitals, meds, notes, procedures,
immunizations, abnormal-result alerts) with a range filter (7d/30d/
90d/All by default) and type filter.

```tsx
<EventFeed
  resources={{
    Observation: resources.Observation,
    MedicationRequest: resources.MedicationRequest,
    // ... any of DiagnosticReport, DocumentReference, Immunization,
    // MedicationAdministration, Procedure
  }}
/>
```

`resources` is **required and explicit** — `EventFeed` itself is not
context-connected (there's a separate, non-exported `EventFeedWrapper`
that reads context, reachable only through `StaticComponent`'s
`"event_feed"` instruction type). Pass `resources.Observation`/etc.
straight from `useClinicalData()` — no cast needed here since it takes
`object[]`.

#### TimelineChart
`src/components/TimelineChart/`

The most complex component: a shared, pannable/zoomable time axis with
stackable sections. Use when you need several time-based rows (drug
courses, lab trends, arbitrary intervals) visually aligned on one
x-axis — for a single analyte, use `ObservationChart` instead.

```tsx
<TimelineChart title="Patient History">
  <TimelineChart.MedicationsTimeline />
  <TimelineChart.ObservationsTimeline />
  <TimelineChart.BarChartTimeline label="Encounters" rows={encounterRows} />
</TimelineChart>
```

- Every section **must be a descendant of `<TimelineChart>`** (throws
  otherwise — it's context-based).
- `MedicationsTimeline`/`ObservationsTimeline` fall back to
  `useClinicalData()` for `medications`/`observations`/`patient` when
  those props are omitted (**requires `ClinicalDataProvider`** in that
  case); pass them explicitly to opt out of context.
- `BarChartTimeline` is domain-agnostic — no FHIR knowledge, no context
  dependency, takes plain `rows: {label, bars: {x1,x2,color?,tooltip?}[]}[]`.
  Use it for anything interval-shaped that isn't medications/labs.
- `ObservationsTimeline`'s `analytes` prop lets you pin an explicit
  panel of rows (`{code, label, keywords?, unit?, range?, ranges?}`);
  omit it to auto-discover every numeric analyte in the record.
- `MedicationsTimeline`'s `classify` prop lets you override which
  medications are included and how they're grouped/colored/labeled.
- Bar `tooltip` strings need `<Tooltip/>` mounted somewhere in the tree
  to actually render (see [Tooltip](#tooltip)).

#### FindingCard
`src/components/FindingCard/index.tsx`

Card for an AI-generated finding/insight: concern-level badge,
confidence bar, tabbed evidence (labs, meds, conditions, imaging, free
narrative Markdown, cohort stats, score breakdowns), optional action
buttons. No context requirement.

```tsx
<FindingCard
  title="Possible medication interaction"
  concernLevel="high"
  confidenceLevel={0.82}
  evidenceTabs={[{
    label: 'Medications',
    items: [{ kind: 'med', name: 'Warfarin', tag: 'Interacts', tagVariant: 'warning' }],
  }]}
/>
```

`evidenceTabs[].items[]` is a discriminated union on `kind`:
`'lab'|'vital'|'med'|'condition'|'imaging'|'note'|'narrative'|'cohort'|'score'`
— each kind has its own required shape; check
`src/components/FindingCard/index.tsx` for the exact fields per kind
before constructing items.

#### SourceDialog / FhirResourceJsonViewer / AttachmentPreview

The "show me the raw FHIR" stack, used internally by `ObservationCard`
and `EventFeed`.

```tsx
<SourceDialog open={open} onClose={close} resource={observation} />
```

**`SourceDialog` requires `ClinicalDataProvider`** (resolves
`Reference`s against context). `FhirResourceJsonViewer` needs
`allResources` passed explicitly if used standalone (not
context-connected itself):

```tsx
<FhirResourceJsonViewer resource={obs} allResources={resources} />
```

`AttachmentPreview` renders a FHIR `Attachment` — image/PDF/HTML/text
depending on `contentType`. It never fetches a remote `url`; only
inline base64 `data` is actually rendered. HTML attachments render in a
sandboxed iframe (scripts blocked, same-origin allowed) — don't treat
that as full isolation for untrusted content.

#### StaticComponent — LLM-driven rendering
`src/components/StaticComponent.tsx`

**Read this if you're generating UI at runtime rather than writing
JSX.** Takes a JSON string or object describing a UI tree and renders
it, instead of you writing the component calls yourself:

```tsx
<StaticComponent instruction={{
  type: 'column',
  children: [
    { type: 'text', content: 'Recent labs' },
    { type: 'lab_trend_panel', labs: ['CRP', 'Hemoglobin'] },
    { type: 'observation_panel', filters: ['Labs'] },
  ],
}} />
```

Valid `type` values and their extra fields:

| `type` | Extra fields | Renders |
|---|---|---|
| `text` | `content: string` | Plain text |
| `observation_card` | `observationId: string` | `ObservationCard` for that id (looked up from context) |
| `observation_panel` | `title?, filters?` | `ObservationsPanel` |
| `lab_trend_panel` | same as `LabTrendPanel` props | `LabTrendPanel` |
| `chart` | `chartType: ChartType` + rest of `ChartProps` | `Chart` |
| `medication_list` \| `condition_list` \| `immunization_list` | `title?` | Context-connected list |
| `event_feed` | `EventFeed` props minus `resources` (context-connected) | `EventFeed` |
| `finding_card` | `FindingCard` props minus function props (`title` required) | `FindingCard` |
| `column` / `row` | `children: Instruction[]`, `className?`, (`row` also `cols?`) | `Column`/`Row` wrapping recursively-rendered children |

Every case except `text`/`chart`/`column`/`row`/`finding_card`
**requires `ClinicalDataProvider`**. Each rendered instruction is
wrapped in an error boundary — one bad instruction shows an inline
error box, not a crash. `sanitizeProps` strips anything that looks like
an unsafe event-handler string (e.g. an LLM emitting
`"onClick": "doStuff()"` as a string instead of omitting it) — so
malformed instructions degrade rather than execute arbitrary strings as
handlers. Unrecognized `type` values render `Unhandled type: {type}`
instead of throwing.

### Data grid

#### DataGrid
`src/components/DataGrid/DataGrid.tsx`, types in
`src/components/DataGrid/types.ts`

Full-featured table: sortable columns, drag-resizable columns (the last
visible column always auto-fills remaining space; double-click a resize
handle to release a column back to auto-fill), search with
highlighting, pagination row, row selection, optional row-navigation
icon column, column-visibility menu.

It needs no backend — it's a pure, controlled presentation component
(see below); everything it displays is handed to it by the caller.
There used to be a separate backend-fetching variant
(`src/components/DataGrid/index.tsx`) that drove sort/pagination/filter
through URL query params against a `url` prop, but it depended on
things that don't exist in this codebase (a `react-router` dependency
that was never added, a `request` helper that was never written) and
has been removed. If you need a data grid that talks to a backend,
build that fetching logic yourself and drive `DataGrid` with the
result — same shape as the `FhirDataGrid` pattern below.

```tsx
<DataGrid
  columns={[
    { propName: 'name', label: 'Name', dataType: 'string', sortProp: 'name' },
    { propName: 'age',  label: 'Age',  dataType: 'number', sortProp: 'age' },
  ]}
  rows={currentPageRows}
  count={totalRowCount}
  offset={offset}
  limit={limit}
  identity="id"
  selection={selection}
  onSelectionChange={setSelection}
  sortColumn={sortColumn}
  sortDir={sortDir}
  onSortChange={(col, dir) => { /* re-sort and setSortColumn/Dir */ }}
  onPaginationChange={setOffset}
  search={search}
  onSearchChange={setSearch}
/>
```

**Critical: this is a controlled component for data operations, same
convention as `Pagination`.** It does not sort/filter/paginate `rows`
itself — you pass the already-processed current page, and respond to
`onSortChange`/`onPaginationChange`/`onSearchChange` to reproduce that
against your source data. The one exception is search *highlighting* of
matched text, which works client-side regardless of whether you wire
`onSearchChange` — the grid always knows the live search term.

`DataGridColumn.dataType`: `'string'|'number'|'boolean'|'json'|'date'|
'id'` — controls default cell rendering when `renderCell` isn't given.
Only columns with `sortProp` set are sort-clickable. Column widths
auto-measure from content on first paint, then lock; a column stays
"auto" (fills leftover space, tracks container width) until the user
drags it, at which point it pins to a fixed width.

`filters`/`onFilterChange` are declared on `DataGridProps` but **not
read anywhere in the component** — there's no built-in filter UI yet;
they're a placeholder for a filter panel you'd build yourself.

#### FhirDataGrid pattern (not exported from the package)

`src/components/DataGrid/FhirDataGrid.tsx` wraps `DataGrid` for
FHIR resources whose shape isn't known ahead of time — it infers up to
12 columns from the properties actually present across the resources,
with FHIR-aware cell rendering (Coding/CodeableConcept/Reference/array
handling) and its own internal sort/search/pagination state (unlike
`DataGrid`, this one is *not* a controlled component — it manages
data shaping itself). It is **not exported from `src/index.ts`** — copy
the file into your app if you need this pattern; treat it as reference
code rather than a hardened component (it has debug `console.log`
calls, and its `columns` prop is currently ignored — it always infers
columns regardless of what you pass).

### Charts

#### Chart
`src/components/Chart/`

Generic Recharts wrapper for any non-FHIR-specific visualization.

```tsx
<Chart type="line" data={rows} xKey="date" yKey="value" />
<Chart type="pie" slices={[{ name: 'A', value: 10 }, { name: 'B', value: 20 }]} />
```

`type`: `'line'|'area'|'bar'|'column'|'scatter'|'pie'|'radar'|
'radialBar'|'funnel'|'treemap'|'composed'` (`'bar'` = horizontal,
`'column'` = vertical). Use `series: SeriesDef[]` for multi-series data,
or `stratifyBy` to auto-pivot flat rows into one series per unique
value of a field. Renders a "No chart data available" placeholder for
empty data rather than a blank chart.

### Generic UI primitives

Structurally similar, listed together — full prop tables in each
component's source file.

| Component | File | One-liner |
|---|---|---|
| `Badge` | `Badge/Badge.tsx` | Inline pill. `variant`: `danger\|warning\|success\|info\|neutral\|muted\|link`. `radius`: `none\|sm\|md\|lg\|pill\|full`. `hard` = solid vs. tinted. |
| `Button` | `Button/Button.tsx` | Same `variant`/`radius`/`hard`, plus `virtual` (ghost until hover). Underlies `RadioButton`, `MenuButton`, `Pagination`. |
| `Alert` | `Alert/index.tsx` | Block banner, same variant/radius/hard/virtual surface as `Badge`/`Button`. |
| `Panel` | `Panel/Panel.tsx` | Card container. `PanelHeader` takes `title`/`icon`/`rightContent`. **Note:** `PanelBody`/`PanelToolbar`/`PanelFooter`/`PanelHeader` are not re-exported from the package root today — only `Panel` is — so you can't currently build a full custom panel layout without reaching into the subpath. |
| `Row` / `Column` | `Row/`, `Column/` | Flex layout wrappers. `Row` takes `cols?: string` to switch to CSS grid. |
| `Dialog` | `Dialog/index.tsx` | Modal, portal-rendered. `open`/`onClose`/`title`/`children` all required. Unmounts (not just hides) when closed. |
| `Collapse` | `Collapse/index.tsx` | Expand/collapse. `label` (always visible) + `children` (collapsible). Controlled via `open`/`onToggle`, or self-managed if `open` omitted. |
| `Tabs` | `Tabs/index.tsx` | `Tabs > TabBar > Tab` + `Tabs > TabsBody > TabContents`, matched by **position**, not id. Must be nested inside `<Tabs>` or it throws. |
| `Loader` | `Loader/index.tsx` | Spinner. `msg?` shows text beside it, `centered?` flex-centers it. |
| `CheckBox` | `CheckBox/index.tsx` | `<input type="checkbox">` wrapper adding `indeterminate` support. |
| `RadioButton` | `RadioButton/index.tsx` | Segmented single-select built on `Button`, not native radios. Fully controlled: `value`, `onChange`, `options`. |
| `Menu`, `MenuItem`, `MenuItemGroupHeader`, `MenuSeparator` | `Menu/index.tsx` | Presentational only — `MenuItem` isn't itself clickable, wrap it in a `<button>`/`<label>`. Pair with `MenuButton` for open/close behavior. |
| `MenuButton` | `MenuButton/index.tsx` | Button + positioned dropdown, opened via CSS `:focus-within` (no JS open state). Needs `tabIndex={0}` on the trigger for keyboard use. `menuPositionX`: `left\|right\|center`. `menuPositionY`: `top\|bottom\|middle`. |
| `Pagination` | `Pagination/index.tsx` | Numbered pager. Fully controlled: `offset`, `limit`, `total`, `onChange`. Renders `null` for fewer than 2 pages. Same controlled-component convention as `DataGrid`. |
| `ItemList` | `ItemList/index.tsx` | Editable list of strings or key/value pairs. **Mutates the `params` array in place** before calling `onChange` — treat the reference as unstable, re-render off `onChange`. |
| `Dot` | `Dot/index.tsx` | Small color indicator. `color?: string` (any CSS color). |
| `DateDisplay` | `Date/DateDisplay.tsx` | Formatted date + native tooltip of the raw value. |
| `List`/`ListItem` | `List/*.tsx` | Plain scrollable list container + row. |
| `JsonViewer` | `JsonViewer/index.tsx` | Generic recursive JSON tree. `renderValue?` customizes leaf rendering — this is what `FhirResourceJsonViewer` builds on. |
| `Sparkline` | `Sparkline/index.tsx` | Multi-series inline SVG line chart. `series: {points, color?, range?, dot?}[]` where `points` is an `"x,y x,y ..."` string. Used by `ObservationCard`/`LabTrendPanel`; `computeMultiSparklines` (not exported at root) builds `series` from FHIR observations. |

#### Tooltip
`src/components/Tooltip/index.tsx`

A **global singleton**, not a per-element wrapper component. Mount it
once:

```tsx
<Tooltip />
```

Then trigger it from *any* element (including non-React DOM) with
`data-tooltip-*` attributes:

```tsx
<div data-tooltip="**Bold** and _italic_ supported" data-tooltip-trigger="click">
  Hover or click me
</div>
```

Key attributes: `data-tooltip` (content, small Markdown subset),
`data-tooltip-trigger` (`mouseover|click|focus`, default `mouseover`),
`data-tooltip-x`/`data-tooltip-y` (placement axes), `data-tooltip-anchor`
(CSS selector for what the bubble should point at, for a moving
target inside a wide trigger). Several other components
(`TimelineChart` bars, `ObservationChart` markers) already emit
`data-tooltip` attributes and will show nothing until you mount
`<Tooltip/>` somewhere in the tree.

## Utilities

### `utils` namespace

```ts
import { utils } from 'clinical-primitives';
```

| Function | Signature | Purpose |
|---|---|---|
| `utils.groupBy` | `(data, prop) => Record<string, any[]>` | Group array by a property value |
| `utils.ellipsis` | `(text, maxLength) => string` | Truncate with `...` |
| `utils.roundToPrecision` | `(num, precision) => number` | Round to N decimals |
| `utils.classList` | `(classes: Record<string, boolean\|undefined>) => string` | Join truthy class names |
| `utils.getPath` | `(obj, path?: string) => any` | Dotted-path getter, handles arrays mid-path |
| `utils.capitalize` | `(str) => string` | |
| `utils.highlightText` | `(text, search?) => ReactNode` | Wraps matches in `<mark class="cp-search-highlight">` — what `DataGrid` search uses |
| `utils.Condition.getName/getClinicalStatus/getVerificationStatus/getBodySite/getOnset/getAbatement` | `(condition) => string\|null` | Field extraction with FHIR fallback chains |
| `utils.Immunization.getName/getOccurrence/getStatusReason/getRoute` | `(immunization) => string\|null` | Same pattern |

### `lib` namespace

```ts
import { lib } from 'clinical-primitives';
```

| Namespace | Key functions |
|---|---|
| `lib.formatDate(dateStr, options?)` | Formats a date; returns `'—'` for falsy input |
| `lib.Person` | `displayName(humanName)`, `displayPersonName(person, use?)`, `displayAddress`, `displayPersonAddress`, `displayPersonGender` |
| `lib.Patient` | `calcAge(patient) => {age, unit}`, `displayPatientAge(patient, units?)` |
| `lib.Identifier` | `format`, `matches`, `findAll`, `find` — filtering/formatting FHIR `Identifier`s |
| `lib.Medication` | `getMedicationName`, `getShortMedicationName`, `normalizeMedName`, `getActiveMedications`, `getMedicationPeriod` (marked provisional — validated only against Synthea sample data), `getMedicationDosages` |

Prefer `lib.Medication` over anything in
`src/components/Medication/utils.ts` — the latter is an older, less
complete duplicate not included in the `utils` namespace object.

## Styling & theming

Import once: `import 'clinical-primitives/styles.css'`.

- **Dark mode**: set `data-theme="dark"` or `data-theme="light"` on
  `<html>`; omit the attribute to follow the OS
  (`prefers-color-scheme`). Only the `win-*`/`txt-*` surface/text tones
  actually differ between themes — accent colors (`red`, `blue`, etc.)
  don't change.
- **Color tokens** (`--cp-color-{name}`): `red, amber, yellow, green,
  teal, blue, gray, purple, white, black, win, win-1..win-7 (surfaces),
  txt, txt-1..txt-7 (text)`. Utility classes: `cp-fill-{name}`,
  `cp-border-{name}`, `cp-text-{name}`, each with `cp-fill-opacity-{0,
  10,...,100}` variants.
- **Spacing** (`--cp-space-1..7`, 0.1rem→2rem): utility classes
  `cp-p-{n}`, `cp-m-{n}`, `cp-gap-{n}`, plus directional variants
  (`cp-ps/pe/pt/pb/px/py`, `cp-ms/me/mt/mb`).
- **Radius**: `cp-rounded-{sm|md|lg|pill|full|none}`.
- **Font size**: `cp-text-{xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl}`.
- **Component variants** follow `cp-{component}--{variant}` /
  `cp-{component}--{variant}-hard`, where variant is the shared union
  `danger|warning|success|info|neutral|muted|link` used by `Badge`,
  `Button`, `Alert`.

## Known gaps (don't rely on these)

- `DataGridProps.filters`/`onFilterChange` — declared, not implemented.
- `DataGridColumn.nullable`/`editor` — declared, not read anywhere.
- `SourceDialog`'s `minWidth`/`maxWidth`/`height` props — declared, not
  used (use `style` instead).
- `FhirJsonDecorator`'s `type` prop — accepted, not read.
- `FhirDataGrid`'s `columns` prop — accepted, ignored (always infers).
- `Panel` subcomponents (`PanelHeader`, `PanelBody`, `PanelToolbar`,
  `PanelFooter`) aren't re-exported from the package root.
- `lib.Medication.getMedicationPeriod` — provisional precedence order,
  validated only against Synthea-generated sample data.
