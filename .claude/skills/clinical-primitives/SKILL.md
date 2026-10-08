---
name: clinical-primitives
description: Build React apps with the clinical-primitives component library (github.com/smart-on-fhir/clinical-primitives) - FHIR-aware condition, medication, immunization and lab lists, lab trend panels, observation charts, treatment timelines, event feeds, data grids, AI finding cards, and the JSON-driven StaticComponent renderer. Use this whenever the user wants a healthcare, clinical, patient or FHIR app or dashboard in React, mentions clinical-primitives, smart-on-fhir components, ClinicalDataProvider, LabTrendPanel or TimelineChart, wants to show patients, labs, meds, problems or a treatment timeline from FHIR data, or is setting up an IHL hackathon app, even if they never name the library.
---

# Building apps with clinical-primitives

React 19 components for clinical UI. Two halves: generic primitives (Badge, Button, Panel, Dialog, DataGrid, Chart, Tooltip) and FHIR-aware components that render `fhir/r4` resources. The library is pre-1.0, so props move. When something here disagrees with your app's `node_modules/clinical-primitives/dist/**/*.d.ts`, the `.d.ts` files are right. For implementation detail, read the source at https://github.com/smart-on-fhir/clinical-primitives (paths below such as `src/components/...` are relative to that repo), and its `AGENTS.md`.

- Per-component props, the StaticComponent schema (with a system prompt to paste into an LLM), utils and theming tokens: [reference.md](reference.md)
- Working usage of every component: the docs site in a clinical-primitives clone. Each page in `src/docs/pages/` renders one component against a real Synthea bundle (`src/docs/samplePatientBundle.json`) and imports from `"clinical-primitives"` the way an app does. Run `npm install && npm run dev` in the clone to see them live. Read the matching page before writing a component from scratch.

Related skills, each in its own repo:
- **`cohort-fhir-api`** (in [fhir-rest-api](https://github.com/smart-on-fhir/fhir-rest-api)): pulling patients from the IHL synthetic cohort API. Fetch with that skill and load the result with `loadFromResources`/`loadFromBundle`; `loadFromFHIRServer` only talks to servers with `Patient/$everything`.
- **`sds-cache`** (in [smart-data-services](https://github.com/smart-on-fhir/smart-data-services)): the caching proxy in front of that cohort API. **`sds-nlp-results`** and **`sds-study-variables`** (same repo): NLP extractions from notes, and study variables and population cubes, to show beside the record. **`sds-identity`** (same repo): mapping MRNs to anonymized patient ids, with no clinical data.
- **`sim-ibd-patients`** (in [cumulus-sim-ibd-patients](https://github.com/smart-on-fhir/cumulus-sim-ibd-patients)): the same synthetic IBD patients as local files, for an offline or static app.

## Setup (Vite + React 19 + TypeScript)

```bash
npm create vite@latest my-app -- --template react-ts && cd my-app
npm install github:smart-on-fhir/clinical-primitives   # clones + builds the lib (~1 min)
npm install -D @types/fhir                             # for `import type { Observation } from 'fhir/r4'`
```

Requirements: Node 20.19+ or 22.12+ (Vite 7), and `react`/`react-dom` ^19 (a peer dependency, so React 18 won't work). `package-lock.json` pins the library commit, and `npm update clinical-primitives` pulls the latest `main`.

`src/main.tsx` imports the styles once, before your own CSS:

```tsx
import 'clinical-primitives/styles.css';
import './app.css';            // your own CSS, after the library's
```

The order matters with Tailwind v4 (see the CSS reset gotcha below).

Wrap the app in **one** `ClinicalDataProvider`, and mount **one** `<Tooltip />` inside it. Without `<Tooltip />`, the timeline bars, chart points, `LabTrendPanel`'s explanations and every `data-tooltip` attribute show nothing on hover:

```tsx
<ClinicalDataProvider>
  <YourRoutes />
  <Tooltip />
</ClinicalDataProvider>
```

The library defaults the page to the system sans-serif font; set `font-family` on `body` to use your own, and library components inherit it. A minimal `app.css`:

```css
body { margin: 0; }
```

## Getting data in

The provider holds **one patient at a time**: `patient`, plus `resources` keyed by resourceType. Load with `useClinicalData()`:

| Source | Call |
|---|---|
| FHIR Bundle JSON (file in `public/`, upload) | `loadFromBundle(bundle)` / `selectFile()` (native picker; .json or .ndjson) |
| Array of resources you fetched yourself | `loadFromResources(resources)` |
| Standard FHIR R4 server with `Patient/$everything` (e.g. r4.smarthealthit.org) | `loadFromFHIRServer(base, id)`, or fetch and then `loadFromResources` (recipe 2) |
| IHL synthetic cohort API | a single-patient record from the `cohort-fhir-api` skill, then `loadFromResources` (or `loadFromBundle` for a saved Bundle) |
| IHL synthetic IBD patients as files | a single-patient FHIR Bundle from the `sim-ibd-patients` skill, with `loadFromBundle` |

Every loader throws unless the input holds **exactly one** `Patient`. A multi-patient bundle or ndjson throws, and so does a record assembled without its Patient. For a cohort, keep the patient list in your own state and load one record into the provider when a patient is opened (recipe 2).

NDJSON rows must each have a `resourceType` and an `id`; the load throws on the first one that doesn't, naming its line. A non-FHIR NDJSON concatenated with the real files (a provenance or audit sidecar, say) fails that way. Load only real FHIR files.

## I need to… → use

| Need | Use |
|---|---|
| Problems / immunizations / meds list with status tabs | `ConditionList`, `ImmunizationList`, `MedicationList` (pass arrays) |
| Compact table of labs: sparkline, latest value, flag | `LabTrendPanel` |
| One analyte as a full chart with ref-range shading | `ObservationChart` |
| One vital/lab as a card with delta + sparkline | `ObservationCard` |
| Browsable grid of every observation, filter tabs | `ObservationsPanel` |
| Meds, labs and visits on one zoomable time axis | `TimelineChart` + `.MedicationsTimeline` / `.ObservationsTimeline` / `.BarChartTimeline` |
| Chronological feed of labs, meds, notes, procedures | `EventFeed` |
| Patient list / any table: sort, search, page, select | `DataGrid` (controlled) |
| Generic chart (line/bar/pie/scatter…) | `Chart` |
| AI finding with confidence + evidence tabs | `FindingCard` |
| UI described by an LLM as JSON | `StaticComponent` |
| Raw FHIR viewer for a resource | `SourceDialog` (modal) or `FhirResourceJsonViewer` |
| Content + resizable details sidebar | `SidebarLayout` |
| Pills, buttons, banners, spinners, modals, tabs | `Badge`, `Button`, `Alert`, `Loader`, `Dialog`, `Tabs` |
| Names, ages, dates, med names | `lib.Person.displayPersonName`, `lib.Patient.displayPatientAge`, `lib.formatDate`, `lib.Medication.getMedicationName` |

## Recipes

The docs pages show each component on its own; these excerpts cover what they don't: wiring several components to one loaded patient, and switching patients.

**1. Single-patient dashboard.** Read the provider and lay components out in a plain CSS grid.
```tsx
const { patient, resources, isLoading, error } = useClinicalData();
const conditions = (resources.Condition ?? []) as unknown as Condition[];   // cast: see gotchas
<ConditionList conditions={conditions} title="Problems" />
<MedicationList medications={(resources.MedicationRequest ?? []) as unknown as MedicationRequest[]} />
<LabTrendPanel labs={[{ label: 'CRP', loincs: ['1988-5'] }, { label: 'Hemoglobin', loincs: ['718-7'] }]} />
<ObservationsPanel filters={['Vitals', 'Labs']} />
<EventFeed resources={resources} defaultRange="All" />   {/* default '30d' counts back from the latest event */}
```

**2. Patient picker over a multi-patient source.** Keep the patient list in your own state (a controlled `DataGrid`; see `src/docs/pages/DataGridPage.tsx`), and when a patient is opened, swap the provider's record. `fetchRecord` is yours: it returns one patient's resources, Patient included (for the cohort API, see the `cohort-fhir-api` skill; for local files, fetch that patient's Bundle and call `loadFromBundle` instead). The load effect is the part people get wrong:
```tsx
const { patient, error, loadFromResources, clear } = useClinicalData();
useEffect(() => {
  const ctrl = new AbortController();
  clear();
  fetchRecord(patientId, ctrl.signal)
    .then(rs => { if (!ctrl.signal.aborted) return loadFromResources(rs); })
    .catch(e => { if (!ctrl.signal.aborted) console.error(e); });
  return () => ctrl.abort();
}, [patientId, clear, loadFromResources]);            // both stable, so this runs once per patientId
if (patient?.id !== patientId) return <Loader msg="Loading…" centered />;   // never show the previous patient
```

**3. Treatment timeline.** Full example: `src/docs/pages/TimelineChartPage.tsx`.
```tsx
<TimelineChart title={<h3>Treatment history</h3>} minX={start} maxX={end}>
  <TimelineChart.MedicationsTimeline classify={classify} legend={entries => …} />
  <TimelineChart.ObservationsTimeline label="Labs" analytes={[{ code: ['718-7'], label: 'Hemoglobin', unit: 'g/dL' }]} showAbsent={false} />
  <TimelineChart.BarChartTimeline label="Visits" rows={[{ label: 'Encounters', bars: [{ x1: ms, x2: ms, tooltip: '**Visit**' }] }]} />
</TimelineChart>
```
The chart opens on the **last 2 years**, so a record that ended earlier looks empty. Pass `minX`/`maxX` (epoch ms) computed from the data. `MedicationsTimeline` shows only **active** meds by default. Its classifier receives `base === null` for the rest, and returning a classification anyway includes them. Wrap `classify` in `useCallback`.

**4. Lab trends.** A `LabTrendPanel` with LOINC-only entries (see the lab-matching gotcha), plus one `ObservationChart` per lab that has data. Full examples: `src/docs/pages/LabTrendPanelPage.tsx`, `ObservationChartPage.tsx`.
```tsx
<LabTrendPanel title="Inflammatory markers" labs={LABS /* {label, loincs}[] at module scope */} />
<ObservationChart observations={observations} code={lab.loincs} label={lab.label} height={160} />
```

**5. LLM-driven UI.** Put the system prompt from reference.md (StaticComponent section) in the model's system prompt, then render its reply with `<StaticComponent instruction={jsonStringOrObject} />` inside the provider. Bad JSON or a failing instruction shows an inline danger `Alert`, and an unknown `type` a line of red text, not a crash. Try instructions live in `src/docs/pages/StaticComponentPlayground.tsx`.

## Gotchas (each one has bitten someone)

- **Context requirements.** These throw outside `ClinicalDataProvider`: `ObservationsPanel`, `LabTrendPanel` (no prop for passing observations), `ObservationCard`, `SourceDialog`, `ResourceSource`, `MedicationDetail`, `ObservationDetail`, `StaticComponent`'s clinical types, and **`TimelineChart.MedicationsTimeline`/`.ObservationsTimeline`, even when you pass `medications`/`observations` explicitly** (`BarChartTimeline` alone is context-free). `EventFeed` renders without the provider, but clicking a row opens `SourceDialog` and throws. The simplest rule is to always render inside the provider.
- **The `as unknown as X[]` cast.** `resources.Condition` is a loose `FhirResource[]`, so typed props need `(resources.Condition ?? []) as unknown as Condition[]`. This is expected. `EventFeed` takes `resources` as-is.
- **Exactly one Patient** per load (see above). Multi-patient data goes through your own list state.
- **Context functions are stable.** Every function from `useClinicalData()` keeps its identity for the life of the provider, so list them in effect deps as the lint rule asks. Guard renders with `patient?.id === wantedId` so the previous patient never shows while the next one loads.
- **`selectFile()` rejects on a bad file.** It resolves `null` on cancel, but a file that fails to load rejects (and also sets `error`), so `catch` it when you await it. (Safari before 16.4 sends no cancel event; there the promise settles as `null` on the next `selectFile()` call.)
- **`loadFromFHIRServer` + abort.** Pass `{ signal }` and abort it in the effect cleanup; that's safe under StrictMode's double mount. An aborted load doesn't set `error`, but its promise rejects with the abort error, so `catch` it. Overlapping loads are fine too: only the newest one writes the context.
- **FHIR dates.** A date-only value (`"2024-01-01"`, `"2024-03"`) names a calendar day, but `new Date(str).toLocaleDateString()` shows the day before anywhere west of UTC. Format with `lib.formatDate(str)` or `<DateDisplay date={str} />`, which keep date-only values on their own day and precision (`"2024-03"` → "Mar 2024"). Pass them the original string: a `Date` from `utils.Observation.getObservationDate` is already UTC midnight.
- **Controlled DataGrid and Pagination.** They never sort, filter or page `rows` themselves. You pass the current page and handle `onSortChange`/`onSearchChange`/`onPaginationChange` (reset `offset` to 0 on sort/search). Only columns with `sortProp` are sortable. Column visibility is fixed **on first mount**, so columns added later start hidden. Pass every column from the first render.
- **Lists scroll only in a bounded box.** `ConditionList`, `MedicationList`, `ImmunizationList`, `EventFeed` and other panels scroll when their container has a definite height; otherwise they grow to show every item. Give the container a height (`style={{ height: '50vh' }}` on a flex row of lists), or use `<Row>`/`<Column>` inside a shell that has one: they shrink to their share of it.
- **How lab rows pick readings.** Each reading goes to at most one row. A row takes readings coded with one of its LOINC codes; a reading coded in LOINC under any other code goes to no row, whatever its name says (HbA1c stays out of `'Hemoglobin'`). Keywords only reach readings with a local code or none, as whole words, longest match winning (`'PreAlbumin'` over `'Albumin'`). If your data uses LOINC codes a preset lacks, pass `{ label, loincs: [...] }` with those codes. The `'CRP'` preset includes hs-CRP (`30522-7`), whose reference range is lower than standard CRP's. Rows convert units within a dimension (mg/dL into mg/L) but not between mass and molar, so in `'VitaminD'`/`'VitaminB12'` readings in the other unit are left out (noted under the row name). `ObservationChart` matches by exact codes only. The preset `LABS` dictionary isn't exported.
- **No `referenceRange` means no flags.** `LabTrendPanel` grades the latest reading by its own `interpretation`/`referenceRange`, or else by the range on an older reading in the same row. When no reading has either, the flag column reads `—`, and there is no prop for supplying ranges; `ObservationChart` (`referenceRange`, `rangeOverride`) and `ObservationsTimeline` (analyte `range`/`ranges`, `referenceRange`) take ranges you supply.
- **Medication courses need a period.** `lib.Medication.getMedicationPeriod` reads `dosageInstruction[].timing.repeat.boundsPeriod`, then `dispenseRequest.validityPeriod`, then `effectivePeriod`. Orders with none of these get only a start instant (`authoredOn`/`effectiveDateTime`/`dateAsserted`), so they have no course duration to draw.
- **Dead or reserved props, so don't wire them**: `DataGrid` `filters`/`onFilterChange`, column `nullable`/`editor`; `SourceDialog` `minWidth`/`maxWidth`/`height` (use `style`); `FhirJsonDecorator` `type`.
- **Not exported**: `PanelHeader`/`PanelBody`/`PanelFooter`/`PanelToolbar` (only `Panel`, a bare `div.cp-panel`), the `LABS`/`FILTERS` dictionaries, the context-connected `*ListWrapper`/`EventFeedWrapper` (reachable only through `StaticComponent`), and the TimelineChart selection context.
- **CSS reset vs Tailwind.** The library resets margin/padding/border inside every element with a `cp-` class, including children you pass to `Panel`, `Dialog`, `Column`…. The reset sits in a `cp-reset` cascade layer, so Tailwind v4 utilities on those children win **only if the library's CSS loads before yours**. If your CSS must load first, put `@layer cp-reset;` at the very top of it, before `@import "tailwindcss";`. Ranked under Tailwind, the reset also loses to its preflight, which flattens headings you pass into library components to body text; size them with Tailwind or `cp-text-*`/`cp-fw-*` classes.
- **Stable inputs.** `ObservationChart`'s `code`, `MedicationsTimeline`'s `classify` and `ObservationsTimeline`'s `analytes` are memo dependencies. Define them at module scope or memoize them.
- **Default time windows hide history.** TimelineChart opens on the last 2 years, and EventFeed shows only the 30 days ending at the latest event. Set `minX`/`maxX` and `defaultRange="All"`.
- **Bundle size.** The library pulls in Recharts and syntax highlighting, so expect a ~1 MB JS chunk and Vite's "chunk larger than 500 kB" warning. That warning is harmless.
