export const sections = [
  { id: 'basic-components',   label: 'Basic Components',       path: '/basic-components'  , group: 'Generic Components' },
  { id: 'fhir-json-viewer',   label: 'FhirResourceJsonViewer', path: '/fhir-json-viewer'  , group: 'FHIR Components'    },
  { id: 'source-dialog',      label: 'SourceDialog',           path: '/source-dialog'     , group: 'FHIR Components'    },
  { id: 'condition-list',     label: 'ConditionList',          path: '/condition-list'    , group: 'FHIR Components'    },
  { id: 'immunization-list',  label: 'ImmunizationList',       path: '/immunization-list' , group: 'FHIR Components'    },
  { id: 'medication-list',    label: 'MedicationList',         path: '/medication-list'   , group: 'FHIR Components'    },
  { id: 'observation-card',   label: 'ObservationCard',        path: '/observation-card'  , group: 'FHIR Components'    },
  { id: 'event-feed',         label: 'EventFeed',              path: '/event-feed'        , group: 'FHIR Components'    },
  { id: 'observations-panel', label: 'ObservationsPanel',      path: '/observations-panel', group: 'FHIR Components'    },
  { id: 'lab-trend-panel',    label: 'LabTrendPanel',          path: '/lab-trend-panel'   , group: 'FHIR Components'    },
  { id: 'finding-card',       label: 'FindingCard',            path: '/finding-card'      , group: 'FHIR Components'    },
  { id: 'chart',              label: 'Chart',                  path: '/chart'             , group: 'Generic Components' },
  { id: 'data-grid',          label: 'DataGrid',               path: '/data-grid'         , group: 'Generic Components' },
  { id: 'timeline-chart',     label: 'TimelineChart',          path: '/timeline-chart'    , group: 'FHIR Components'    },
  { id: 'tooltip',            label: 'Tooltip',                path: '/tooltip'           , group: 'Generic Components' },
  { id: 'menu',               label: 'Menu',                   path: '/menu'              , group: 'Generic Components' },
  { id: 'menu-button',        label: 'MenuButton',             path: '/menu-button'       , group: 'Generic Components' },
  { id: 'pagination',         label: 'Pagination',             path: '/pagination'        , group: 'Generic Components' },
  { id: 'item-list',          label: 'ItemList',               path: '/item-list'         , group: 'Generic Components' },
  { id: 'observation-chart',  label: 'ObservationChart',       path: '/observation-chart' , group: 'FHIR Components'    },
  { id: 'playground',         label: 'Playground',             path: '/playground'        , group: 'Other'              },
] as const;

export type SectionId = (typeof sections)[number]['id'];

export function getSectionIdFromPath(pathname: string): SectionId {
  // Strip the Vite base path (e.g. /clinical-primitives) so route matching
  // works both in dev (base = '/') and on GitHub Pages (base = '/clinical-primitives/').
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const relative = base ? pathname.replace(base, '') || '/' : pathname;
  return sections.find((section) => section.path === relative)?.id ?? sections[0].id;
}