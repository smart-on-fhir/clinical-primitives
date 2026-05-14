export const sections = [
  { id: 'basic-components',    label: 'Basic Components',       path: '/basic-components'      },
  { id: 'fhir-json-viewer',    label: 'FhirResourceJsonViewer', path: '/fhir-json-viewer'      },
  { id: 'source-dialog',       label: 'SourceDialog',           path: '/source-dialog'         },
  { id: 'condition-list',      label: 'ConditionList',          path: '/condition-list'        },
  { id: 'immunization-list',   label: 'ImmunizationList',       path: '/immunization-list'     },
  { id: 'medication-list',     label: 'MedicationList',         path: '/medication-list'       },
  { id: 'observation-card',    label: 'ObservationCard',        path: '/observation-card'      },
  { id: 'event-feed',          label: 'EventFeed',              path: '/event-feed'            },
  { id: 'observations-panel',  label: 'ObservationsPanel',      path: '/observations-panel'    },
  { id: 'lab-trend-panel',     label: 'LabTrendPanel',          path: '/lab-trend-panel'       },
] as const;

export type SectionId = (typeof sections)[number]['id'];

export function getSectionIdFromPath(pathname: string): SectionId {
  // Strip the Vite base path (e.g. /clinical-primitives) so route matching
  // works both in dev (base = '/') and on GitHub Pages (base = '/clinical-primitives/').
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const relative = base ? pathname.replace(base, '') || '/' : pathname;
  return sections.find((section) => section.path === relative)?.id ?? sections[0].id;
}