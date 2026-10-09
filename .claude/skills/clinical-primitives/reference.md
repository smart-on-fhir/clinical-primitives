# clinical-primitives component reference

Props checked against the library source at https://github.com/smart-on-fhir/clinical-primitives (`src/index.ts` and the component files) as of 2026-10-08. The library is pre-1.0. If a prop here doesn't match the version in your app, check `node_modules/clinical-primitives/dist/components/**/*.d.ts`. Source paths below are relative to that repo.

Contents: [Data layer](#data-layer) · [Clinical lists](#clinical-lists) · [Observations](#observations) · [TimelineChart](#timelinechart) · [EventFeed](#eventfeed) · [FindingCard](#findingcard) · [StaticComponent](#staticcomponent) · [Source viewers and detail panels](#source-viewers-and-detail-panels) · [DataGrid and Pagination](#datagrid-and-pagination) · [Chart](#chart) · [Generic primitives](#generic-primitives) · [Tooltip](#tooltip) · [utils and lib](#utils-and-lib) · [Styling](#styling)

"ctx" below means the component needs `ClinicalDataProvider` above it.

## Data layer

`useClinicalData()` throws outside the provider and returns:

| Field | Type | Notes |
|---|---|---|
| `patient` | `Patient \| null` | |
| `resources` | `Record<string, FhirResource[]>` | Keyed by resourceType. Loose type, so cast before passing to typed props. |
| `isLoading`, `error` | `boolean`, `Error \| null` | |
| `loadFromBundle(bundle)` / `loadFromBundleFile(file)` | `Promise<PatientDataSet>` | Each one sets state **and** rethrows on failure. |
| `loadFromResources(resources)` | same | Use it for anything you fetched yourself. |
| `loadFromNdjson(text)` / `loadFromNdjsonFile(file)` | same | Throws on the first line with no `resourceType` or no `id`, naming the line. |
| `loadFromFHIRServer(base, patientId, opts?)` | same | Pages through `GET {base}/Patient/{id}/$everything?_count=200` and updates `resources` as each page arrives. `opts`: `{ signal, count=200, throttleMs=500, retries=3, retryDelayMs=1000 }`. Network errors, 5xx, 408 and 429 are retried with exponential backoff; other 4xx fail at once. Aborting also cuts short a throttle or backoff wait. Needs a standard FHIR server that implements `$everything`; for any other API, fetch the record yourself and call `loadFromResources`. |
| `selectFile()` | `Promise<Patient \| null>` | Native picker for .json/.ndjson. Resolves `null` on cancel (or when a later `selectFile()` call takes over the picker); rejects (and sets `error`) if the file fails to load. |
| `clear()` | `() => void` | Also drops in-flight `lazy`/`getPatient` bookkeeping. |
| `lazy(type, fetcher, {force?})` | `Promise<T[]>` | Fetches one resource type on demand and caches it in `resources[type]`. Concurrent calls share one fetch, `force` or not. A fetch overtaken by a load or `clear()` doesn't write. |
| `getPatient(id, fetcher)` | `Promise<Patient>` | Sets `patient` from a fetcher unless it's already loaded. Calls for the same id share a fetch; when calls overlap, only the latest one sets `patient`. |

Every function keeps its identity for the life of the provider, so they're safe in effect dependencies. `loadFromFHIRServer` empties `patient`/`resources` before its first page; an aborted load rejects with the abort error but leaves `error` alone. When loads overlap, only the newest one writes the context.

Exported helpers: `bundleToResources(bundle)`, `parseNdjson(text)`, `resourcesToPatientDataSet(resources)` (throws unless exactly one Patient), `resolvePatientDataSource({type:'bundle'|'bundle-file'|'resources'|'ndjson'|'ndjson-file', …})`. Exported types: `FhirBundle`, `FhirResource`, `PatientDataSet`, `PatientDataSource`, `PatientResource`.

## Clinical lists

These take arrays as props, without ctx. Each renders a panel with status tabs, newest first.

```tsx
<ConditionList conditions={Condition[]} title?="Conditions" />
<ImmunizationList immunizations={Immunization[]} title? />
<MedicationList medications={MedicationRequest[] | MedicationAdministration[]} title? />  // one type per list, not mixed
```

## Observations

**`LabTrendPanel`** (ctx; reads `resources.Observation`, with no prop for passing your own)
- `labs: (LabTrendEntry | PresetKey)[]`, where `LabTrendEntry = { label, loincs?: string[], keywords?: string[] }`. Each reading goes to at most one row: a matching code wins; a reading coded in LOINC under a code no row lists goes nowhere; otherwise the longest whole-word keyword match in `code.text`/`coding.display` wins.
- `title?: ReactNode` (default "Lab Trends"), `meta?: ReactNode` (right side of the header).
- Unknown preset keys are skipped with a `console.warn`. If no row has data, it renders `null`.
- Preset keys: CRP ESR Albumin Calprotectin Hemoglobin Platelets Weight Height BMI PreAlbumin PCT Ferritin VitaminD VitaminB12 WBC RBC Hematocrit MCV MCH MCHC RDW Neutrophils Lymphocytes Monocytes Eosinophils Basophils MPV ALT AST HeartRate OxygenSat Temperature RespRate BloodPressure. Add `{label, loincs}` objects for LOINC codes the presets lack.
- Flags: `↑H`/`↓L`/`↑↑`/`↓↓` from interpretation codes; otherwise computed against the latest reading's range (or an older reading's): `↑`/`↓` slightly out, `↑↑`/`↓↓` far out, `!` abnormal with no direction, `—` nothing to grade by.
- Readings in another unit of the same dimension are converted to the latest reading's unit (mg/dL into mg/L); ones that can't be (mass vs. molar) are dropped and noted under the row name.
- The name, range, sparkline, value and flag cells carry `data-tooltip` explanations, shown only with `<Tooltip />` mounted.

**`ObservationChart`** (no ctx)
- Required: `observations: Observation[]`, `code: string | string[] | (obs) => boolean`. `code` is a memo dependency, so keep it stable.
- Common: `label?`, `height?`, `series?: {code?, label?, color?}[]` (multi-line), `onSelectPoint?(obs)`, `selectedId?`, `crosshair?`, `minMaxLabels?`, `declaredUnit?`, `referenceRange?` (resolver), `rangeOverride?`, `carryRange?`, `abnormalColor?`, `warningColor?`, `className?`.
- Set `mapX` only when embedding inside a TimelineChart. The `series` item type is exported as `ObservationChartSeries`.

**`ObservationCard`** (ctx): `observation: Observation`, `history?: Observation[]` (already filtered to the same analyte), `style?`. Handles up to 2 components (e.g. BP). With more than that, it shows a placeholder.

**`ObservationsPanel`** (ctx): `title?`, `filters?: ('All'|'Vitals'|'Labs'|'Social'|'Activity'|'IBD')[]`. Filtering is by `category` (vital-signs, laboratory, …). 'IBD' keeps readings whose code is in the lab presets and whose name has one of their keywords. The Date/Status order toggle shows only when ordering by status would change some tab (it never does for data with no `interpretation` or `referenceRange`, e.g. Synthea), and Status is disabled on a tab where it changes nothing.

**`ObservationHistoryTable`**: `history: Observation[]`.

Reference-range helpers are also exported: `resolveRange`, `statusFor`, `toneFor`, `rangeZones`, `readInterpretation`, `boundsFromObservation`, `boundRuns`, `rangeGradientStops`, `RANGE_MARGIN`, `splinePath`.

## TimelineChart

```tsx
<TimelineChart title?={ReactNode} minX?={ms} maxX?={ms} limitStart?={ms} limitEnd?={ms}
               ranges?={[{label, title?, years?, months?}]} ruler?={true}>
  …sections…
</TimelineChart>
```
- `minX`/`maxX` set the **opening** window, which defaults to the last 2 years. `limitStart`/`limitEnd` set how far the user can pan, and default to 100 years back and 10 forward. `ranges` are the preset pills (default 2y/5y/10y/All); pass `[]` to hide them.
- Sections must be descendants (they throw otherwise). The selection highlight color is the CSS variable `--cp-timeline-selection-color`.

**`TimelineChart.MedicationsTimeline`** (ctx even when `medications` is passed)
- `medications?: (MedicationRequest | MedicationAdministration)[]`. Defaults to both types from context.
- `label?` (default "Medications"), `legend?: ReactNode | (entries: MedicationLegendEntry[]) => ReactNode`, `settings?: ReactNode`.
- `classify?: MedicationClassifier = (base, med, { includeInactive }) => MedicationClassification | null`. `base` is the default result, and it's **null for non-active meds** while the section's "only active" toggle is on (the default). Return `null` to drop a med. Classification fields: `name?`, `group?` (row key), `label?`, `color?`, `className?`, `order?`, `category?: {key,label}` (feeds the legend).
- A med with no end date and an ongoing status is drawn up to now. A med with no period is drawn as a point at its authored date.

**`TimelineChart.ObservationsTimeline`** (ctx even when `observations` is passed)
- `observations?`, `analytes?: TimelineAnalyte[]` (omit it to auto-discover every numeric analyte, keyed by first coding), `patient?`, `label?`/`title?` (default "Observations"), `rowHeight?` (48), `initiallyShown?` (10), `showAbsent?` (true, which lists pinned analytes the record lacks), `carryRange?`, `referenceRange?`, `rangeEdits?`, `settings?`.
- `TimelineAnalyte = { code: string | string[], label, keywords?, unit?, defaultShown?, range?: {low?, high?}, ranges?: AgeBand[] }`. The first code is the analyte's identity.

**`TimelineChart.BarChartTimeline`** (no ctx, no FHIR)
- `label`, `rows: { label: ReactNode, bars: TimelineBar[] }[]`, plus `legend?`, `settings?`, `narrative?`, `selection?` (sidebar content), `rowHeight?`, `dataRangeStart?`/`dataRangeEnd?`.
- `TimelineBar = { x1: ms, x2: ms, color?, className?, id?, tooltip? (markdown, needs <Tooltip/>), onSelect?() }`.

Exported types: `MedicationClassifier`, `MedicationLegendEntry`, `TimelineMedication`, `TimelineAnalyte`.

## EventFeed

```tsx
<EventFeed resources={Record<string, object[]>} title?="Patient timeline"
  rangeOptions?={[{label:'7d',days:7},{label:'30d',days:30},{label:'90d',days:90},{label:'All',days:null}]}
  defaultRange?="30d" includeTypes?={['lab','vitals','alert','med','note','procedure','immunization']}
  maxHeight? minHeight? />
```
It reads Observation, MedicationRequest, MedicationAdministration, DocumentReference, DiagnosticReport, Procedure and Immunization. A finite range ends at the latest event when that event is older than the window. Clicking a row opens `SourceDialog`, which needs ctx.

## FindingCard

`title` (required), `description?`, `concernLevel?: 'low'|'moderate'|'high'`, `confidenceLevel?: 0..1`, `evidenceTabs?: {label, items: EvidenceItem[]}[]`, `actionButtons?: Record<string, () => void>`, `dismiss?: () => void`.

`EvidenceItem` by `kind`:

| kind | fields |
|---|---|
| `lab`, `vital` | `name, value, unit?, sub?, flag?: 'high'\|'low'\|'critical'` |
| `med` | `name, note?, tag?, tagVariant?: 'warning'\|'success'\|'danger'\|'muted'\|'info'` |
| `condition` | `name, onset?, status?` |
| `imaging` | `title, date?, conclusion?` |
| `note` | `title, date?, category?, snippet?` |
| `narrative` | `text` (Markdown) |
| `cohort` | `description, n?, stat?` |
| `score` | `name, total?, components?: {label, value}[]` |

## StaticComponent

`<StaticComponent instruction={string | object | object[]} />`. It accepts a JSON string, an object, or an array (rendered in sequence).

| `type` | Fields | ctx? |
|---|---|---|
| `text` | `content` | no |
| `row` / `column` | `children` (node or array), `className?`, row: `cols?` (CSS grid template) | no |
| `chart` | `chartType` + `Chart` props (`data`, `xKey`, `yKey`, `series`, `slices`, …) | no |
| `finding_card` | `FindingCard` props minus functions | no |
| `lab_trend_panel` | `labs`, `title?`, `meta?` | yes |
| `observation_panel` | `title?`, `filters?` | yes |
| `observation_card` | `observationId` (looked up in context) | yes |
| `condition_list` / `medication_list` / `immunization_list` | `title?` | yes |
| `event_feed` | `EventFeed` props minus `resources` | yes |

Each node except `text` renders inside an error boundary, and a failing node shows a danger `Alert` in place. Unknown types render "Unhandled type: …" in red, and bad JSON renders an "Invalid render instruction" `Alert`. Props that look like event handlers (`on*` strings), string `style` values and non-string `className` values are dropped.

**System prompt for an LLM.** Paste this into the model's system prompt so it replies with a valid instruction tree, then pass the reply to `<StaticComponent instruction={reply} />` inside the provider.

```text
Reply with ONE JSON object (no prose, no code fence) describing the UI.
Node types:
  {"type":"text","content":string}
  {"type":"row","cols"?:css-grid-template,"children":[node...]}
  {"type":"column","children":[node...]}
  {"type":"lab_trend_panel","title"?:string,"labs":[{"label":string,"loincs":[string]}]}
  {"type":"observation_panel","title"?:string,"filters"?:["All"|"Vitals"|"Labs"|"Social"|"Activity"|"IBD"]}
  {"type":"observation_card","observationId":string}
  {"type":"condition_list"|"medication_list"|"immunization_list","title"?:string}
  {"type":"event_feed","title"?:string,"defaultRange"?:"7d"|"30d"|"90d"|"All"}
  {"type":"chart","chartType":"line"|"bar"|"column"|"pie"|...,"data":[{...}],"xKey":string,"yKey":string}
  {"type":"finding_card","title":string,"concernLevel"?:"low"|"moderate"|"high","confidenceLevel"?:0..1,
   "evidenceTabs"?:[{"label":string,"items":[{"kind":"narrative","text":markdown}|{"kind":"med","name":string}|...]}]}
Never include event handlers.
```

Give the model the patient's actual LOINC codes (from `resources.Observation`) so it doesn't invent labs.

## Source viewers and detail panels

- `SourceDialog` (ctx): `open`, `onClose`, `resource`, `title?`, `prependTabs?`, `style?`. Its `minWidth`/`maxWidth`/`height` props are ignored; set size through `style`.
- `FhirResourceJsonViewer` (no ctx): `resource`, `allResources` (for resolving references).
- `AttachmentPreview`: renders an `Attachment` from inline base64 `data` only and never fetches `url`. HTML renders in a sandboxed iframe that blocks scripts but allows same-origin, so don't treat it as isolation for untrusted HTML.
- `ResourceSource` (ctx): `resource`. Use it inside an element with class `cp-resource-detail`.
- `MedicationDetail` (ctx): `medication`. `ObservationDetail` (ctx): `observation`. These are the timeline's sidebar panels.
- `SidebarLayout`: `open`, `sidebar`, `children`, `title?`, `onClose?`, `defaultWidth?` (400), `defaultFraction?`, `minWidth?` (288), `maxFraction?` (0.6), `className?`, `style?`. The main column sits outside the library reset, so Tailwind keeps working there.

## DataGrid and Pagination

`DataGrid` is controlled. You do the sorting, searching and paging, and pass the current page:

| Prop | Notes |
|---|---|
| `columns: DataGridColumn[]` | `{ propName, label, dataType?: 'string'\|'number'\|'boolean'\|'json'\|'date'\|'id', sortProp?, renderCell?(row, all), renderHeader?, visible?, width?, minWidth?, tdProps?, thProps? }` |
| `rows`, `count`, `offset`, `limit` | the current page, the total after filtering, and the window |
| `identity` + `selection` + `onSelectionChange` | adds selection checkboxes |
| `sortColumn`, `sortDir`, `onSortChange(col, dir)` | only columns with `sortProp` are clickable |
| `search`, `onSearchChange(s)` | the search box. Highlighting is automatic; filtering is your job. |
| `onPaginationChange(offset)` | the pager appears when `count > 0` and this is set |
| `onNavigate(row, index)` | adds an arrow column for "open" |
| `title?`, `loading?`, `error?`, `className?` | |

Column visibility is captured on first mount, so columns added later start hidden. `filters`, `onFilterChange`, `nullable` and `editor` do nothing.

`Pagination`: `offset`, `limit`, `total`, `onChange(offset)`. It renders `null` for fewer than 2 pages.

The unexported `FhirDataGrid` ([`src/components/DataGrid/FhirDataGrid.tsx`](https://github.com/smart-on-fhir/clinical-primitives/blob/main/src/components/DataGrid/FhirDataGrid.tsx) in the library repo) infers columns from arbitrary resources. Copy it if needed, and remove its `console.log` calls.

## Chart

Wraps Recharts. Props: `type: 'line'|'area'|'bar'|'column'|'scatter'|'pie'|'radar'|'radialBar'|'funnel'|'treemap'|'composed'` (`bar` is horizontal, `column` is vertical), `data?`, `xKey?`, `yKey?`, `series?: {key, name?, color?, data?, chartType?}[]`, `stratifyBy?` (pivots rows into one series per value), `slices?: {name, value, color?}[]` (pie), `height?`, `colors?`, `showLegend?`, `showGrid?`, `xLabel?`, `yLabel?`, `className?`. Empty data shows a placeholder. Exported types: `ChartProps`, `ChartType`, `SeriesDef`, `PieSlice`, `ChartDataRecord`.

## Generic primitives

| Component | Key props |
|---|---|
| `Badge` | `variant: danger\|warning\|success\|info\|neutral\|muted\|link` (default neutral), `radius: none\|sm\|md\|lg\|pill\|full`, `hard` |
| `Button` | same as Badge plus `virtual` (ghost until hover) and all `<button>` attributes |
| `Alert` | same as Button |
| `Panel` | a `div.cp-panel`. Its header, body and footer subcomponents are not exported. |
| `Row` / `Column` | flex wrappers. `Row` `cols?` switches it to a grid. In a container of definite height they shrink to their share, so lists inside scroll; set `style={{ minHeight }}` for a floor. |
| `Dialog` | `open`, `onClose`, `title`, `children`, `style?`. Portal-rendered and unmounted when closed. |
| `Collapse` | `label`, `children`, optional controlled `open`/`onToggle` |
| `Tabs` | `<Tabs defaultIndex?><TabBar><Tab/>…</TabBar><TabsBody><TabContents/>…</TabsBody></Tabs>`. Tabs and contents are matched by position. Uncontrolled by default; pass `activeIndex` to control it, and `onActiveIndexChange(i)` hears clicks either way. |
| `Loader` | `msg?`, `centered?` |
| `CheckBox` | native checkbox props plus `indeterminate` |
| `RadioButton` | `value`, `onChange`, `options: {value, label, title?, disabled?}[]` |
| `Menu`, `MenuItem`, `MenuItemGroupHeader`, `MenuSeparator`, `MenuButton` | `MenuButton`: `menu`, `menuPositionX: left\|right\|center`, `menuPositionY: top\|bottom\|middle`. It opens through CSS `:focus-within`. `MenuItem` isn't clickable on its own, so wrap it in a button. |
| `ItemList` | edits strings or key/value pairs and **mutates** `params` in place before `onChange` |
| `DateDisplay` | `date: string \| Date` plus `Intl.DateTimeFormatOptions` fields. Formats like `lib.formatDate`, with the raw value as a native tooltip. |
| `Dot`, `List`/`ListItem`, `JsonViewer`, `Sparkline` | small helpers |

## Tooltip

Mount `<Tooltip />` once (optional props: `delay`, `offset`, `viewportPadding`, `maxWidth`). Then put attributes on any element:

`data-tooltip` (content in a Markdown subset: `**bold**`, `_italic_`, `\n`), `data-tooltip-trigger` (`mouseover`|`click`|`focus`), `data-tooltip-x` (`left|center|right|pointer`), `data-tooltip-y` (`top|middle|bottom|pointer`), `data-tooltip-position` (`inside|outside`), `data-tooltip-delay`, `data-tooltip-offset`, `data-tooltip-max-width`, `data-tooltip-anchor` (CSS selector), `data-tooltip-viewport`, `data-tooltip-class`. Exported types: `TooltipProps`, `TooltipTrigger`, `TooltipPosition`, `TooltipX`, `TooltipY`, `TooltipAxisX`, `TooltipAxisY`.

## utils and lib

```ts
import { lib, utils } from 'clinical-primitives';
```
- `lib.formatDate(value: string | Date | null | undefined, opts?)` returns `'—'` for empty input and an unparseable string as given. `opts` picks year/month/day (default `{year:'numeric', month:'short', day:'numeric'}`). Date-only values stay on their own calendar day in every time zone and at their own precision (`"2019"` → "2019", `"2024-03"` → "Mar 2024"); dateTimes show in local time.
- `lib.Person`: `displayName(humanName)`, `displayPersonName(person, use?)`, `displayAddress`, `displayPersonAddress`, `displayPersonGender`.
- `lib.Patient`: `calcAge(p) => {age, unit}` (both `null` without a `birthDate`, or when `deceasedBoolean` is true) and `displayPatientAge(p, units?)` (`null` in those cases; `units === false` gives the bare number).
- `lib.Identifier`: `format`, `matches`, `findAll`, `find`.
- `lib.Medication`: `getMedicationName`, `getShortMedicationName`, `normalizeMedName`, `getActiveMedications`, `getMedicationPeriod` (provisional), `getMedicationDosages`.
- `utils`: `groupBy`, `ellipsis`, `roundToPrecision`, `classList`, `getPath`, `capitalize`, `highlightText`, plus `utils.Condition.*`, `utils.Immunization.*` and `utils.Observation.*` (`getObservationDisplayName`, `getObservationValue`, `getObservationDate`, `extractObservationNumericValue`, `computeDelta`, `unitScale(from, to)`, `cleanUnit`, `inUnitOf(observations, reference)` (readings rescaled to `reference`'s unit, plus a `dropped` count of unconvertible ones), …). `getObservationDate` returns `new Date(str)`, so a date-only value is UTC midnight; format the original string with `lib.formatDate` instead.

## Styling

- Dark mode: `data-theme="dark"|"light"` on `<html>`. Without it, the theme follows the OS. Only the surface (`win*`) and text (`txt*`) tones change.
- Tokens: `--cp-color-{red,amber,yellow,green,teal,blue,gray,purple,white,black,win,win-1..7,txt,txt-1..7}`, `--cp-space-1..7`, `--cp-text-{xs..6xl}`. Use them in your own CSS (`background: var(--cp-color-win-1)`) so the app follows the theme.
- Utility classes: `cp-fill-*`, `cp-border-*`, `cp-text-*` (colors and sizes), `cp-fw-*` (`normal`/`medium`/`semibold`/`bold`/`100`…`900`), `cp-p-*`/`cp-m-*`/`cp-gap-*`, `cp-rounded-*`.
- The library's scoped reset zeroes margin/padding/border inside `cp-*` elements. It sits in the `cp-reset` layer: load the library CSS before yours (or start yours with `@layer cp-reset;`) and Tailwind v4 utilities win over it. Under Tailwind, preflight also beats the reset's heading sizes, so headings you pass in render as body text unless you size them.
- Font: the `cp-reset` layer sets a system sans-serif on `html`. Any `font-family` you set on `html`, `body` or a wrapper wins, and components inherit it.
