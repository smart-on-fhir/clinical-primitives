import { useState }         from 'react';
import type { Observation } from 'fhir/r4';
import { Tab, TabBar, TabContents, Tabs, TabsBody } from '../Tabs';
import { Button }           from '../Button/Button';
import { Badge }            from '../Badge/Badge';
import { ObservationCard }  from '.';
import {
    getObservationGroupKey,
    getObservationValue,
    getObservationDate,
    getObservationStatus
} from './utils';
import { useClinicalData }  from '../../library';
import './ObservationsPanel.scss';
import { FILTERS, type ObservationFilter } from './ObservationFilters';

// Re-export so consumers that import from this module still work.
export type { ObservationFilter };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a "Latest" filter covering the 7 days up to the most recent observation, or null if there are no dated observations. */
function makeLatestFilter(groups: { latestObservation: Observation }[]): ObservationFilter | null {
    const latestDay = groups.reduce<string | null>((best, { latestObservation }) => {
        const d = getObservationDate(latestObservation);
        if (!d) return best;
        const day = d.toISOString().slice(0, 10);
        return best === null || day > best ? day : best;
    }, null);

    if (!latestDay) return null;

    const latestMs = new Date(latestDay).getTime();
    return {
        label: 'Latest',
        // A 7-day window so persistent observations (BP Location, smoking status,
        // etc.) recorded at a prior visit are still included.
        after:  new Date(latestMs - 7 * 864e5),
        before: new Date(latestDay),
    };
}

/** Evaluates an ObservationFilter against a single observation. An empty filter matches everything. */
function matchesFilter(obs: Observation, filter: ObservationFilter): boolean {
    if (filter.categories?.length) {
        const ok = filter.categories.some(code =>
            (obs.category ?? []).some(cat => (cat.coding ?? []).some(c => c.code === code))
        );
        if (!ok) return false;
    }

    if (filter.codes?.length) {
        const obsCodes = new Set((obs.code?.coding ?? []).map(c => c.code).filter(Boolean));
        if (!filter.codes.some(c => obsCodes.has(c))) return false;
    }

    if (filter.keywords?.length) {
        const haystack = [obs.code?.text, ...(obs.code?.coding ?? []).map(c => c.display)]
            .filter(Boolean).join(' ').toLowerCase();
        if (!filter.keywords.some(kw => haystack.includes(kw.toLowerCase()))) return false;
    }

    if (filter.after || filter.before) {
        const d = getObservationDate(obs);
        if (!d) return false;
        const obsDay = new Date(d.toISOString().slice(0, 10));
        if (filter.after  && obsDay < filter.after)  return false;
        if (filter.before && obsDay > filter.before) return false;
    }

    return true;
}

function isDisplayableObservation(obs: Observation): boolean {
    const { value } = getObservationValue(obs);
    if (!value) return false;
    const rawName = obs.code?.text || obs.code?.coding?.[0]?.display || '';
    if (rawName.length > 120) return false;
    const isSurvey = (obs.category ?? []).some(cat =>
        (cat.coding ?? []).some(c => c.code === 'survey')
    );
    if (isSurvey && rawName.includes('?')) return false;
    return true;
}

/** Deduplicate observations by concept identity, keeping the most recent of each type. */
function groupByName(observations: Observation[]): { latestObservation: Observation; history: Observation[] }[] {
    const groups = new Map<string, Observation[]>();
    for (const obs of observations) {
        if (!isDisplayableObservation(obs)) continue;
        const key = getObservationGroupKey(obs);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(obs);
    }
    return Array.from(groups.values()).map((obs) => {
        const sorted = [...obs].sort(
            (a, b) =>
                new Date(b.effectiveDateTime || b.issued || '').getTime() -
                new Date(a.effectiveDateTime || a.issued || '').getTime()
        );
        return { latestObservation: sorted[0], history: sorted };
    });
}

function ObsGrid({ groups }: { groups: { latestObservation: Observation; history: Observation[] }[] }) {
    return (
        <div className="obs-grid">
            {groups.length === 0 ? (
                <div className="obs-empty">No observations in this category.</div>
            ) : (
                groups.map(({ latestObservation, history }, i) => (
                    <ObservationCard
                        key={latestObservation.id ?? i}
                        observation={latestObservation}
                        history={history}
                    />
                ))
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObservationsPanel({
    title = 'Observations',
    filters = [],
}: {
    title?: string;
    filters?: (keyof typeof FILTERS)[];
}) {

    const { resources } = useClinicalData();
    const [sortBy, setSortBy] = useState<'date' | 'status'>('date');

    const observations = (resources.Observation || []) as unknown as Observation[];

    const groups = groupByName(observations);

    const allFilters: ObservationFilter[] = Array.isArray(filters) && filters.length > 0 ?
        filters.map(f => FILTERS[f]).filter(Boolean) :
        [
            FILTERS.All,
            ...[makeLatestFilter(groups)].filter(Boolean) as ObservationFilter[],
        ];

    const STATUS_RANK: Record<string, number> = { abnormal: 0, warn: 1, ok: 2 };
    type Group = { latestObservation: Observation; history: Observation[] };
    function sortGroups(gs: Group[]): Group[] {
        if (sortBy === 'date') {
            return [...gs].sort((a, b) =>
                (getObservationDate(b.latestObservation)?.getTime() ?? 0) -
                (getObservationDate(a.latestObservation)?.getTime() ?? 0)
            );
        }
        return [...gs].sort((a, b) => {
            const sa = getObservationStatus(a.latestObservation);
            const sb = getObservationStatus(b.latestObservation);
            const ra = sa ? (STATUS_RANK[sa] ?? 3) : 3;
            const rb = sb ? (STATUS_RANK[sb] ?? 3) : 3;
            if (ra !== rb) return ra - rb;
            return (getObservationDate(b.latestObservation)?.getTime() ?? 0) -
                   (getObservationDate(a.latestObservation)?.getTime() ?? 0);
        });
    }

    const tabs: any[] = allFilters.map(f => {
        const filtered = f.label === 'All'
            ? groups
            : groups.filter(({ latestObservation }) => matchesFilter(latestObservation, f));
        return {
            label: f.label,
            count: filtered.length,
            hidden: filtered.length === 0,
            content: <ObsGrid groups={sortGroups(filtered)} />,
        };
    });

    const isEmpty = tabs.every(t => t.count === 0);

    return (
        <div className="obs-panel">
            <div className="obs-panel-header">
                <span className="obs-panel-title">{title}</span>
                { !isEmpty && <div style={{ display: 'flex', gap: 2, alignItems: 'center' }} className='cp-text-txt-7 cp-text-sm'>
                    <span className='cp-me-3'>Order:</span>
                    <Button variant='info' virtual={sortBy !== 'date'} hard className='cp-py-2 cp-px-4 cp-rounded-pill' onClick={() => setSortBy('date')}>
                        Date
                    </Button>
                    <Button variant='info' virtual={sortBy !== 'status'} hard className='cp-py-2 cp-px-4 cp-rounded-pill' onClick={() => setSortBy('status')}>
                        Status
                    </Button>
                </div> }
            </div>
            { isEmpty ?
                <div className="obs-empty">No observations to display.</div> :
                tabs.length > 1 ?
                    <Tabs>
                        <TabBar>
                            {tabs.map((t, i) => (
                                <Tab key={i} hidden={t.hidden} style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
                                    {t.label} <Badge variant="muted" className="cp-text-xs">{t.count}</Badge>
                                </Tab>
                            ))}
                        </TabBar>
                        <TabsBody>
                            {tabs.map((t, i) => (
                                <TabContents key={i} hidden={t.hidden}>
                                    {t.content}
                                </TabContents>
                            ))}
                        </TabsBody>
                    </Tabs> :
                    <div className="obs-empty">No observations to display.</div>
            }
        </div>
    );
}

export function ObservationsPanelWrapper({ title, filters }: { title?: string; filters?: (keyof typeof FILTERS)[] }) {
    return (
        <ObservationsPanel
            title={title ?? "Observations"}
            filters={filters}
        />
    );
}
