import { ReactNode, useState } from "react";
import "./FindingCard.scss";
import { Badge } from "../Badge/Badge";
import { Button, Row } from "../..";

// ---------------------------------------------------------------------------
// Evidence types
// ---------------------------------------------------------------------------

export type EvidenceLabItem = {
    kind: 'lab' | 'vital';
    name: string;
    value: string;
    unit?: string;
    sub?: string;
    flag?: 'high' | 'low' | 'critical';
};

export type EvidenceMedItem = {
    kind: 'med';
    name: string;
    note?: string;
    tag?: string;
    tagVariant?: 'warning' | 'success' | 'danger' | 'muted' | 'info';
};

export type EvidenceConditionItem = {
    kind: 'condition';
    name: string;
    onset?: string;
    status?: string;
};

export type EvidenceImagingItem = {
    kind: 'imaging';
    title: string;
    date?: string;
    conclusion?: string;
};

export type EvidenceNoteItem = {
    kind: 'note';
    title: string;
    date?: string;
    category?: string;
    snippet?: string;
};

export type EvidenceNarrativeItem = {
    kind: 'narrative';
    text: string;
};

export type EvidenceCohortItem = {
    kind: 'cohort';
    description: string;
    /** Population size. */
    n?: number;
    /** Highlighted statistic, e.g. "34% risk of AKI requiring dialysis". */
    stat?: string;
};

export type EvidenceScoreItem = {
    kind: 'score';
    name: string;
    total?: string;
    components?: { label: string; value: string }[];
};

export type EvidenceItem =
    | EvidenceLabItem
    | EvidenceMedItem
    | EvidenceConditionItem
    | EvidenceImagingItem
    | EvidenceNoteItem
    | EvidenceNarrativeItem
    | EvidenceCohortItem
    | EvidenceScoreItem;

export type EvidenceTab = {
    label: string;
    items: EvidenceItem[];
};

// ---------------------------------------------------------------------------
// Evidence item renderers
// ---------------------------------------------------------------------------

function LabCell({ item }: { item: EvidenceLabItem }) {
    const cls = item.flag === 'critical' ? 'cp-ev-val--critical'
              : item.flag               ? 'cp-ev-val--flag'
              : '';
    return (
        <div className="cp-ev-cell">
            <div className="cp-ev-name">{item.name}</div>
            <div className={`cp-ev-val ${cls}`}>
                {item.value}
                {item.unit && <span className="cp-ev-unit"> {item.unit}</span>}
            </div>
            {item.sub && <div className="cp-ev-sub">{item.sub}</div>}
        </div>
    );
}

function MedRow({ item }: { item: EvidenceMedItem }) {
    return (
        <div className="cp-ev-row cp-ev-row--med">
            <span className="cp-ev-row-label">
                {item.name}
                {item.note && <span className="cp-ev-row-note"> — {item.note}</span>}
            </span>
            {item.tag && <Badge variant={item.tagVariant ?? 'muted'} className="cp-text-xs">{item.tag}</Badge>}
        </div>
    );
}

function ConditionRow({ item }: { item: EvidenceConditionItem }) {
    return (
        <div className="cp-ev-row">
            <span className="cp-ev-row-label">{item.name}</span>
            <span className="cp-ev-row-meta">
                {item.onset && <span>{item.onset}</span>}
                {item.status && <Badge variant="muted" className="cp-text-xs">{item.status}</Badge>}
            </span>
        </div>
    );
}

function DocRow({ item }: { item: EvidenceImagingItem | EvidenceNoteItem }) {
    return (
        <div className="cp-ev-row cp-ev-row--doc">
            <div className="cp-ev-doc-title">
                {renderInline(item.title)}
                {item.date && <span className="cp-ev-row-note"> · {item.date}</span>}
            </div>
            {'conclusion' in item && item.conclusion && <div className="cp-ev-doc-snippet">{renderMarkdown(item.conclusion)}</div>}
            {'snippet'    in item && item.snippet    && <div className="cp-ev-doc-snippet">{renderMarkdown(item.snippet)}</div>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Minimal markdown renderer — handles the subset LLMs commonly produce.
// No external dependencies: bold, italic, inline code, bullet/numbered lists,
// and paragraph breaks (double newline).
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode[] {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/);
    return parts.map((part, i) => {
        if (/^\*\*(.+)\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (/^\*(.+)\*$/.test(part))     return <em key={i}>{part.slice(1, -1)}</em>;
        if (/^`(.+)`$/.test(part))       return <code key={i}>{part.slice(1, -1)}</code>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) return <a key={i} href={link[2]} className="cp-ev-link">{link[1]}</a>;
        return part;
    });
}

function renderMarkdown(text: string): React.ReactNode[] {
    return text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0 && lines.every(l => /^[-*]\s/.test(l))) {
            return (
                <ul key={i} className="cp-ev-md-list">
                    {lines.map((l, j) => <li key={j}>{renderInline(l.replace(/^[-*]\s/, ''))}</li>)}
                </ul>
            );
        }
        if (lines.length > 0 && lines.every(l => /^\d+\.\s/.test(l))) {
            return (
                <ol key={i} className="cp-ev-md-list">
                    {lines.map((l, j) => <li key={j}>{renderInline(l.replace(/^\d+\.\s/, ''))}</li>)}
                </ol>
            );
        }
        return <p key={i} className="cp-ev-narrative">{renderInline(block)}</p>;
    });
}

function NarrativeBlock({ item }: { item: EvidenceNarrativeItem }) {
    return <div className="cp-ev-narrative-wrap">{renderMarkdown(item.text)}</div>;
}

function CohortBlock({ item }: { item: EvidenceCohortItem }) {
    return (
        <div className="cp-ev-cohort">
            {item.stat && <div className="cp-ev-cohort-stat">{item.stat}</div>}
            <div className="cp-ev-cohort-desc">
                {item.description}
                {item.n !== undefined && <span className="cp-ev-row-note"> (n={item.n.toLocaleString()})</span>}
            </div>
        </div>
    );
}

function ScoreBlock({ item }: { item: EvidenceScoreItem }) {
    return (
        <div className="cp-ev-score">
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4em' }}>
                <span className="cp-ev-score-name">{item.name}</span>
                {item.total && <Badge variant="muted" className="cp-text-sm cp-text-txt cp-fill-win">{item.total}</Badge>}
            </Row>
            {item.components?.map((c, i) => (
                <div key={i} className="cp-ev-score-row">
                    <span>{c.label}</span>
                    <span>{c.value}</span>
                </div>
            ))}
        </div>
    );
}

function EvidenceItemView({ item }: { item: EvidenceItem }) {
    // lab/vital cells are half-width; everything else spans full width.
    switch (item.kind) {
        case 'lab':
        case 'vital':      return <LabCell item={item} />;
        case 'med':        return <MedRow item={item} />;
        case 'condition':  return <ConditionRow item={item} />;
        case 'imaging':
        case 'note':       return <DocRow item={item} />;
        case 'narrative':  return <NarrativeBlock item={item} />;
        case 'cohort':     return <CohortBlock item={item} />;
        case 'score':      return <ScoreBlock item={item} />;
    }
}

// ---------------------------------------------------------------------------
// FindingCard
// ---------------------------------------------------------------------------

export interface FindingCardProps {
    /** What is the finding? */
    title: ReactNode;

    /** Short description of the finding */
    description?: ReactNode;

    /** Concern level of the finding. Defaults to 'low'. */
    concernLevel?: 'low' | 'moderate' | 'high';

    /** Confidence level as a float between 0 and 1 */
    confidenceLevel?: number;

    /**
     * Optional callback for when the finding is dismissed. If not provided,
     * the Dismiss button will not be rendered.
     */
    dismiss?: () => void;

    /** Dynamic evidence tabs. */
    evidenceTabs?: EvidenceTab[];

    /** Action buttons for the finding card. */
    actionButtons?: Record<string, () => void>;
}

export function FindingCard({
    title,
    description,
    concernLevel = 'low',
    confidenceLevel,
    evidenceTabs,
    actionButtons,
    dismiss
}: FindingCardProps) {
    const [activeTab, setActiveTab] = useState(0);
    const tabs = evidenceTabs ?? [];
    const activeItems = tabs[activeTab]?.items ?? [];

    return (
        <div className={`cp-finding-card cp-finding-card--${concernLevel}`}>
            <div className="cp-finding-card-header">
                <div style={{ minWidth: 'min-content', maxWidth: 'max-content', flex: '1 1 min-content', textAlign: 'center' }}>
                    <Badge className="cp-text-sm" style={{ borderWidth: 0, padding: '0.35em 0.75em' }}>
                        {concernLevel === 'low' ? 'Concern' : concernLevel === 'moderate' ? 'Moderate concern' : 'High concern'}
                    </Badge>
                </div>
                <div className="cp-finding-card-header-main">
                    <div className="cp-finding-card-title">{title}</div>
                    {description && <p>{description}</p>}
                    {confidenceLevel !== undefined &&
                        <Row style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingRight: '0.5rem' }}>
                            <div className="cp-text-sm cp-text-txt-6">Confidence:</div>
                            <div style={{ flex: '1 1 0', minWidth: '150px' }}>
                                <div className="cp-progress">
                                    <div className="cp-progress-value" style={{ width: `${confidenceLevel * 100}%` }} />
                                </div>
                            </div>
                            <div className="confidence-level-pct">{(confidenceLevel * 100).toFixed(0)}%</div>
                        </Row>
                    }
                </div>
                { dismiss && !actionButtons && <div style={{ marginLeft: 'auto' }}>
                    <button onClick={dismiss}>Dismiss</button>
                </div> }
            </div>

            {tabs.length > 0 && (
                <div className="cp-finding-card-body">
                    <div className="cp-finding-card-heading">Supporting evidence</div>
                    { tabs.length > 1 && <Row style={{ gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }} className="cp-text-win-7">
                        {tabs.map((tab, i) => (
                            <Button
                                key={tab.label}
                                className="cp-py-3 cp-px-4 cp-rounded-pill cp-fill-win"
                                virtual={i !== activeTab}
                                variant="muted"
                                onClick={() => setActiveTab(i)}
                            >
                                {tab.label}
                            </Button>
                        ))}
                    </Row> }
                    <div className="cp-ev-items">
                        {activeItems.map((item, i) => (
                            <EvidenceItemView key={i} item={item} />
                        ))}
                    </div>
                </div>
            )}

            { actionButtons && <div className="cp-finding-card-footer">
                { Object.keys(actionButtons).map((key) => (
                    <button key={key} onClick={actionButtons[key]} className="cp-finding-card-action-button">
                        {key}
                    </button>
                )) }
                <div style={{ flex: '1 1 0' }} />
                <button>Dismiss</button>
            </div> }
        </div>
    );
}
