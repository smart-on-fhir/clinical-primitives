import { useEffect, useLayoutEffect, useState }           from 'react';
import { getSectionIdFromPath, sections, type SectionId } from './routes';
import { BasicComponentsPage }    from './pages/BasicComponentsPage';
import { FhirJsonViewerPage }     from './pages/FhirJsonViewerPage';
import { SourceDialogPage }       from './pages/SourceDialogPage';
import { ConditionListPage }      from './pages/ConditionListPage';
import { ImmunizationListPage }   from './pages/ImmunizationListPage';
import { MedicationListPage }     from './pages/MedicationListPage';
import { ObservationCardPage }    from './pages/ObservationCardPage';
import { EventFeedPage }          from './pages/EventFeedPage';
import { ObservationsPanelPage }  from './pages/ObservationsPanelPage';
import { LabTrendPanelPage }      from './pages/LabTrendPanelPage';
import { FindingCardPage }        from './pages/FindingCardPage';
import { ClinicalDataProvider }   from '../index';
import { DocsThemeContext }       from './components/DocsThemeContext';

type ThemeMode = 'light' | 'dark' | 'system';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialThemeMode(): ThemeMode {
  const storedTheme = window.localStorage.getItem('cp-docs-theme');

  return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : 'system';
}

// Set data-theme before the first React paint to avoid a flash on load.
{
  const mode = getInitialThemeMode();
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function DocsApp() {
  const [activeSection, setActiveSection] = useState<SectionId>(() => getSectionIdFromPath(window.location.pathname));
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  useEffect(() => {
    const onLocationChange = () => {
      setActiveSection(getSectionIdFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', onLocationChange);
    return () => window.removeEventListener('popstate', onLocationChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const onThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', onThemeChange);
    return () => mediaQuery.removeEventListener('change', onThemeChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('cp-docs-theme', themeMode);
  }, [themeMode]);

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode;

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const navigateTo = (sectionId: SectionId) => {
    const section = sections.find((entry) => entry.id === sectionId);

    if (!section || section.id === activeSection) {
      return;
    }

    window.history.pushState({}, '', import.meta.env.BASE_URL.replace(/\/$/, '') + section.path);
    setActiveSection(section.id);
  };

  const activePage = {
    'basic-components':    <BasicComponentsPage />,
    'fhir-json-viewer':    <FhirJsonViewerPage />,
    'source-dialog':       <SourceDialogPage />,
    'condition-list':      <ConditionListPage />,
    'immunization-list':   <ImmunizationListPage />,
    'medication-list':     <MedicationListPage />,
    'observation-card':    <ObservationCardPage />,
    'event-feed':          <EventFeedPage />,
    'observations-panel':  <ObservationsPanelPage />,
    'lab-trend-panel':     <LabTrendPanelPage />,
    'finding-card':        <FindingCardPage />,
  }[activeSection];

  return (
    <DocsThemeContext.Provider value={resolvedTheme}>
      <div className="flex h-screen overflow-hidden">
        <aside className="text-nowrap p-4 flex-shrink-0 overflow-y-auto">
          <div>
            <div>
              <p className="">Clinical Primitives</p>
            </div>
            <div>
              <h5 className='font-semibold text-lg mb-2'>Theme</h5>
              <div>
                <label>
                  <input
                    checked={themeMode === 'light'}
                    name="theme"
                    onChange={() => setThemeMode('light')}
                    type="radio"
                  />{' '}
                  Light
                </label>
              </div>
              <div>
                <label>
                  <input
                    checked={themeMode === 'dark'}
                    name="theme"
                    onChange={() => setThemeMode('dark')}
                    type="radio"
                  />{' '}
                  Dark
                </label>
              </div>
              <div>
                <label>
                  <input
                    checked={themeMode === 'system'}
                    name="theme"
                    onChange={() => setThemeMode('system')}
                    type="radio"
                  />{' '}
                  System
                </label>
              </div>
            </div>
            
            <br />
            <br />

            <nav>
              {sections.map((section) => (
                <a
                  key={section.id}
                  className={
                    'block py-2 px-4 cp-text-txt-5' + (
                      section.id === activeSection ?
                      ' cp-fill-win-2' :
                      '  '
                    )
                  }
                  href={section.path}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateTo(section.id);
                  }}
                >
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <main className="p-4 overflow-y-auto flex-1 cp-fill-win">
          <ClinicalDataProvider>
            {activePage}
          </ClinicalDataProvider>
        </main>
      </div>
    </DocsThemeContext.Provider>
  );
}