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
import { ChartPage }              from './pages/ChartPage';
import { TimelineChartPage }      from './pages/TimelineChartPage';
import { TooltipPage }            from './pages/TooltipPage';
import { MenuPage }               from './pages/MenuPage';
import { MenuButtonPage }         from './pages/MenuButtonPage';
import { PaginationPage }         from './pages/PaginationPage';
import { ItemListPage }           from './pages/ItemListPage';
import { ObservationChartPage }   from './pages/ObservationChartPage';
import { Playground }             from './pages/StaticComponentPlayground';
import { ClinicalDataProvider, Tooltip } from '../index';
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
    'chart':               <ChartPage />,
    'timeline-chart':      <TimelineChartPage />,
    'tooltip':             <TooltipPage />,
    'menu':                <MenuPage />,
    'menu-button':         <MenuButtonPage />,
    'pagination':          <PaginationPage />,
    'item-list':           <ItemListPage />,
    'observation-chart':   <ObservationChartPage />,
    'playground':          <Playground />,
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

            <h6 className='cp-pb-2 cp-text-win-6'>Generic Components</h6>
            <hr className='cp-border-b-1 cp-border-win-3 cp-mb-2'/>
            <nav className='cp-mb-6'>
              {sections.filter(s => s.group === "Generic Components").map((section) => (
                <a
                  key={section.id}
                  className={
                    'block py-1 px-2 rounded' + (
                      section.id === activeSection ?
                      ' cp-fill-win-3 cp-text-txt-3' :
                      ' cp-text-txt-5'
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

            <h6 className='cp-pb-2 cp-text-win-6'>FHIR Components</h6>
            <hr className='cp-border-b-1 cp-border-win-3 cp-mb-2'/>
            <nav className='cp-mb-6'>
              {sections.filter(s => s.group === "FHIR Components").map((section) => (
                <a
                  key={section.id}
                  className={
                    'block py-1 px-2 rounded' + (
                      section.id === activeSection ?
                      ' cp-fill-win-3 cp-text-txt-3' :
                      ' cp-text-txt-5'
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

            <h6 className='cp-pb-2 cp-text-win-6'>Other</h6>
            <hr className='cp-border-b-1 cp-border-win-3 cp-mb-2'/>
            <nav className='cp-mb-6'>
              {sections.filter(s => s.group !== "FHIR Components" && s.group !== "Generic Components").map((section) => (
                <a
                  key={section.id}
                  className={
                    'block py-1 px-2 rounded' + (
                      section.id === activeSection ?
                      ' cp-fill-win-3 cp-text-txt-3' :
                      ' cp-text-txt-5'
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
      <Tooltip />
    </DocsThemeContext.Provider>
  );
}