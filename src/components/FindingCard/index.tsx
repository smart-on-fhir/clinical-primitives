import { ReactNode } from "react";
import "./FindingCard.scss";
import { Badge } from "../Badge/Badge";
import { Button, Row } from "../..";

interface FindingCardProps {
    title: ReactNode;
    description?: ReactNode;
    concernLevel: 'low' | 'moderate' | 'high';
    confidenceLevel?: number;
    actionButtons?: ReactNode;
}

export function FindingCard({
    title,
    description,
    concernLevel,
    confidenceLevel,
    actionButtons
}: FindingCardProps) {
    return (
        <div className={`cp-finding-card cp-finding-card--${concernLevel}`}>
            <div className="cp-finding-card-header">
                <div>
                    <Badge className="cp-text-sm" style={{ borderWidth: 0, padding: '0.35em 0.75em' }}>
                        { concernLevel.charAt(0).toUpperCase() + concernLevel.slice(1) } concern
                    </Badge>
                </div>
                <div>
                    <div className="cp-finding-card-title">{ title }</div>
                    { description && <p>{ description }</p> }
                    { confidenceLevel !== undefined && 
                        <Row style={{ alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div className="cp-text-sm cp-text-txt-7">Confidence:</div>
                            <div style={{ flex: '1 1 0', minWidth: '150px' }}>
                                <div className="cp-progress">
                                    <div className="cp-progress-value" style={{ width: `${confidenceLevel}%` }} />
                                </div>
                            </div>
                            <div className="confidence-level-pct">{ confidenceLevel }%</div>
                        </Row>
                    }
                </div>
            </div>
            <div className="cp-finding-card-body">
                <div className="cp-finding-card-heading">
                    Supporting evidence
                </div>
                <Row style={{ gap: '0.5rem', flexWrap: 'wrap' }} className="cp-text-win-7">
                    <Button className="cp-py-3 cp-px-4 cp-rounded-pill cp-fill-win" virtual={false} variant="muted">Labs</Button>
                    <Button className="cp-py-3 cp-px-4 cp-rounded-pill cp-fill-win" virtual={false} variant="muted">Medications</Button>
                    <Button className="cp-py-3 cp-px-4 cp-rounded-pill cp-fill-win" virtual={false} variant="muted">Vitals</Button>
                </Row>
            </div>
            <div className="cp-finding-card-footer">
                { actionButtons }
                <div style={{ flex: '1 1 0' }} />
                <button>Dismiss</button>
            </div>
        </div>
    );
}